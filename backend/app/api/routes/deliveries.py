import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import Delivery, OrderLine, LineStatus, User, UserRole
from app.schemas.schemas import DeliveryCreate, DeliveryOut
from app.core.security import get_current_user, require_admin

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


async def _recalculate_line(line: OrderLine, db: AsyncSession):
    """Recalculate delivered/pending and update line_status."""
    deliveries_result = await db.execute(
        select(Delivery).where(Delivery.order_line_id == line.id)
    )
    deliveries = deliveries_result.scalars().all()
    total_delivered = sum(d.quantity_delivered for d in deliveries)
    line.quantity_delivered = total_delivered
    line.quantity_pending = max(0, (line.quantity_ordered or 0) - total_delivered)

    if total_delivered == 0:
        line.line_status = LineStatus.PENDING
    elif line.quantity_pending == 0:
        line.line_status = LineStatus.COMPLETED
    else:
        line.line_status = LineStatus.PARTIAL


@router.post("/lines/{line_id}", response_model=DeliveryOut, status_code=201)
async def register_delivery(
    line_id: str,
    data: DeliveryCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(OrderLine).where(OrderLine.id == line_id))
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(404, "Order line not found")

    if data.quantity_delivered <= 0:
        raise HTTPException(400, "Quantity must be greater than 0")

    total_after = (line.quantity_delivered or 0) + data.quantity_delivered
    if total_after > (line.quantity_ordered or 0):
        raise HTTPException(
            400,
            f"Cannot deliver {data.quantity_delivered}. "
            f"Only {line.quantity_pending} units pending."
        )

    delivery = Delivery(
        id=str(uuid.uuid4()),
        order_line_id=line_id,
        quantity_delivered=data.quantity_delivered,
        notes=data.notes,
        created_by_id=current_user.id,
    )
    db.add(delivery)

    await _recalculate_line(line, db)
    await db.commit()
    await db.refresh(delivery)
    return delivery


@router.get("/lines/{line_id}", response_model=list[DeliveryOut])
async def get_line_deliveries(
    line_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Delivery)
        .where(Delivery.order_line_id == line_id)
        .order_by(Delivery.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{delivery_id}", status_code=204)
async def delete_delivery(
    delivery_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Delivery).where(Delivery.id == delivery_id))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(404, "Delivery not found")

    line_result = await db.execute(select(OrderLine).where(OrderLine.id == delivery.order_line_id))
    line = line_result.scalar_one_or_none()

    await db.delete(delivery)
    if line:
        await _recalculate_line(line, db)
    await db.commit()
