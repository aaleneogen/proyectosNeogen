import os
import uuid
import aiofiles
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.models.models import PurchaseOrder, OrderLine, OrderStatus
from app.schemas.schemas import (
    PurchaseOrderOut, PurchaseOrderSummary, OrderLineOut, OrderLineUpdate, ProcessingResult
)
from app.services.order_service import process_order
from app.services.export_service import export_order_to_excel
from app.core.config import settings

router = APIRouter(prefix="/orders", tags=["orders"])

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/csv": "csv",
}


@router.post("/upload", response_model=ProcessingResult)
async def upload_order(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    content_type = file.content_type or ""
    ext = ALLOWED_TYPES.get(content_type)

    if not ext:
        filename_lower = (file.filename or "").lower()
        for suffix, extension in [(".pdf", "pdf"), (".xlsx", "xlsx"), (".xls", "xls"), (".csv", "csv")]:
            if filename_lower.endswith(suffix):
                ext = extension
                break

    if not ext:
        raise HTTPException(400, "Unsupported file type. Use PDF, XLSX, XLS or CSV.")

    file_size = 0
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    order_id = str(uuid.uuid4())
    safe_filename = f"{order_id}.{ext}"
    file_path = upload_dir / safe_filename

    async with aiofiles.open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            file_size += len(chunk)
            if file_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                os.unlink(file_path)
                raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")
            await f.write(chunk)

    order = PurchaseOrder(
        id=order_id,
        original_filename=file.filename or safe_filename,
        file_path=str(file_path),
        file_type=ext,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    await db.commit()

    result = await process_order(order_id, str(file_path), ext, db)
    return result


@router.get("/", response_model=list[PurchaseOrderSummary])
async def list_orders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).limit(100)
    )
    orders = result.scalars().all()
    summaries = []
    for o in orders:
        line_result = await db.execute(
            select(func.count()).where(OrderLine.order_id == o.id)
        )
        line_count = line_result.scalar() or 0
        summaries.append(PurchaseOrderSummary(
            id=o.id,
            original_filename=o.original_filename,
            status=o.status,
            distributor=o.distributor,
            created_at=o.created_at,
            line_count=line_count,
        ))
    return summaries


@router.get("/{order_id}", response_model=PurchaseOrderOut)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    lines_result = await db.execute(
        select(OrderLine).where(OrderLine.order_id == order_id).order_by(OrderLine.row_index)
    )
    order.lines = lines_result.scalars().all()
    return order


@router.patch("/{order_id}/lines/{line_id}", response_model=OrderLineOut)
async def update_line(
    order_id: str,
    line_id: str,
    data: OrderLineUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrderLine).where(OrderLine.id == line_id, OrderLine.order_id == order_id)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(404, "Line not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(line, field, value)

    line.manually_reviewed = True
    if line.matched_sku and line.quantity is not None:
        line.is_valid = True

    await db.commit()
    await db.refresh(line)
    return line


@router.post("/{order_id}/export")
async def export_order(order_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    lines_result = await db.execute(
        select(OrderLine).where(OrderLine.order_id == order_id).order_by(OrderLine.row_index)
    )
    order.lines = lines_result.scalars().all()

    try:
        file_path = export_order_to_excel(order)
        order.status = OrderStatus.COMPLETED
        order.exported_at = datetime.utcnow()
        order.export_path = file_path
        await db.commit()

        return FileResponse(
            path=file_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=Path(file_path).name,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
