import os
import uuid
import aiofiles
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.models import PurchaseOrder, OrderLine, OrderStatus, User, UserRole
from app.schemas.schemas import (
    PurchaseOrderOut, PurchaseOrderSummary, OrderLineOut, OrderLineUpdate, ProcessingResult
)
from app.services.order_service import process_order
from app.services.export_service import export_order_to_excel
from app.core.security import get_current_user, require_admin
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
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
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

    # Generate order number
    count_result = await db.execute(select(func.count()).select_from(PurchaseOrder))
    count = (count_result.scalar() or 0) + 1
    order_number = f"OC-{datetime.now().year}-{count:04d}"

    order = PurchaseOrder(
        id=order_id,
        order_number=order_number,
        original_filename=file.filename or safe_filename,
        file_path=str(file_path),
        file_type=ext,
        status=OrderStatus.PENDING,
        created_by_id=current_user.id,
    )
    db.add(order)
    await db.commit()

    result = await process_order(order_id, str(file_path), ext, db)
    return result


@router.get("/", response_model=list[PurchaseOrderSummary])
async def list_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).limit(200)
    if current_user.role == UserRole.ELECO:
        query = query.where(PurchaseOrder.created_by_id == current_user.id)

    result = await db.execute(query)
    orders = result.scalars().all()

    summaries = []
    for o in orders:
        lines_result = await db.execute(
            select(OrderLine).where(OrderLine.order_id == o.id)
        )
        lines = lines_result.scalars().all()
        summaries.append(PurchaseOrderSummary(
            id=o.id,
            order_number=o.order_number,
            original_filename=o.original_filename,
            status=o.status,
            distributor=o.distributor,
            created_at=o.created_at,
            line_count=len(lines),
            lines_pending=sum(1 for l in lines if l.line_status.value == "pending"),
            lines_completed=sum(1 for l in lines if l.line_status.value == "completed"),
        ))
    return summaries


@router.get("/{order_id}", response_model=PurchaseOrderOut)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(selectinload(PurchaseOrder.lines).selectinload(OrderLine.deliveries))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    # ELECO can only see their own orders
    if current_user.role == UserRole.ELECO and order.created_by_id != current_user.id:
        raise HTTPException(403, "Access denied")

    return order


@router.patch("/{order_id}/lines/{line_id}", response_model=OrderLineOut)
async def update_line(
    order_id: str,
    line_id: str,
    data: OrderLineUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OrderLine)
        .where(OrderLine.id == line_id, OrderLine.order_id == order_id)
        .options(selectinload(OrderLine.deliveries))
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(404, "Line not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(line, field, value)

    # Recalculate pending when quantity_ordered changes
    if data.quantity_ordered is not None:
        line.quantity_pending = max(0, data.quantity_ordered - (line.quantity_delivered or 0))

    line.manually_reviewed = True
    if line.matched_sku and line.quantity_ordered:
        line.is_valid = True

    await db.commit()
    await db.refresh(line)
    return line


@router.post("/{order_id}/approve", response_model=PurchaseOrderOut)
async def approve_order(
    order_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = OrderStatus.APPROVED
    await db.commit()

    full = await db.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(selectinload(PurchaseOrder.lines).selectinload(OrderLine.deliveries))
    )
    return full.scalar_one()


@router.post("/{order_id}/export")
async def export_order(
    order_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == order_id)
        .options(selectinload(PurchaseOrder.lines))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Order not found")

    try:
        file_path = export_order_to_excel(order)
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
