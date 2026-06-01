"""
Orchestrates the full order processing pipeline:
upload → parse → match → persist
"""
import shutil
from pathlib import Path
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.models import PurchaseOrder, OrderLine, OrderStatus, MatchConfidence
from app.schemas.schemas import ProcessingResult
from app.services.parser_service import parse_document
from app.services.matching_service import match_product
from app.core.config import settings

import logging
logger = logging.getLogger(__name__)


async def process_order(order_id: str, file_path: str, file_type: str, db: AsyncSession) -> ProcessingResult:
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise ValueError(f"Order {order_id} not found")

    order.status = OrderStatus.PROCESSING
    await db.commit()

    errors: list[str] = []
    try:
        parsed_rows, parse_errors = parse_document(file_path, file_type)
        errors.extend(parse_errors)

        order_lines: list[OrderLine] = []
        matched = 0
        needs_review = 0

        for i, row in enumerate(parsed_rows):
            match = await match_product(row.description, row.unit_price, db)

            warnings = list(match.warnings)
            if row.quantity is None:
                warnings.append("Missing quantity")
            if row.unit_price is None:
                warnings.append("Missing price")

            is_valid = (
                match.sku is not None
                and row.quantity is not None
                and match.confidence != MatchConfidence.NONE
            )

            line = OrderLine(
                order_id=order_id,
                row_index=i,
                raw_description=row.description,
                raw_quantity=row.raw_quantity,
                raw_price=row.raw_price,
                matched_sku=match.sku,
                matched_description=match.description,
                quantity=row.quantity,
                unit_price=match.price,
                confidence=match.confidence,
                confidence_score=match.confidence_score,
                match_method=match.match_method,
                warnings=warnings,
                is_valid=is_valid,
                product_id=match.product_id,
            )
            order_lines.append(line)

            if match.confidence == MatchConfidence.HIGH and is_valid:
                matched += 1
            elif match.confidence != MatchConfidence.NONE:
                needs_review += 1

        db.add_all(order_lines)

        order.status = OrderStatus.REVIEW
        order.processed_at = datetime.utcnow()
        order.parse_errors = errors
        await db.commit()

        return ProcessingResult(
            order_id=order_id,
            status=OrderStatus.REVIEW,
            lines_detected=len(parsed_rows),
            lines_matched=matched,
            lines_needs_review=needs_review,
            parse_errors=errors,
        )

    except Exception as e:
        logger.exception(f"Error processing order {order_id}")
        order.status = OrderStatus.ERROR
        order.parse_errors = [str(e)]
        await db.commit()
        raise
