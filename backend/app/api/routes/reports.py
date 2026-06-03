from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.models.models import PurchaseOrder, OrderLine, Delivery, Product, OrderStatus, LineStatus, User
from app.schemas.schemas import ReportSummary, MonthlyData, TopProduct
from app.core.security import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=ReportSummary)
async def get_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.models import UserRole

    # Base query — ELECO sees only their orders
    order_query = select(PurchaseOrder)
    line_query = select(OrderLine)
    if current_user.role == UserRole.ELECO:
        order_query = order_query.where(PurchaseOrder.created_by_id == current_user.id)
        order_ids_result = await db.execute(
            select(PurchaseOrder.id).where(PurchaseOrder.created_by_id == current_user.id)
        )
        owned_order_ids = [r[0] for r in order_ids_result.all()]
        line_query = line_query.where(OrderLine.order_id.in_(owned_order_ids))

    # Orders
    orders_result = await db.execute(order_query)
    orders = orders_result.scalars().all()

    total_orders = len(orders)
    open_orders = sum(1 for o in orders if o.status not in (OrderStatus.COMPLETED,))
    completed_orders = sum(1 for o in orders if o.status == OrderStatus.COMPLETED)

    # Lines
    lines_result = await db.execute(line_query)
    lines = lines_result.scalars().all()

    total_lines = len(lines)
    pending_lines = sum(1 for l in lines if l.line_status == LineStatus.PENDING)
    partial_lines = sum(1 for l in lines if l.line_status == LineStatus.PARTIAL)
    completed_lines = sum(1 for l in lines if l.line_status == LineStatus.COMPLETED)

    total_amount = sum(
        (l.quantity_ordered or 0) * (l.unit_price or 0) for l in lines if l.is_valid
    )
    delivered_amount = sum(
        (l.quantity_delivered or 0) * (l.unit_price or 0) for l in lines if l.is_valid
    )

    # Monthly orders
    monthly: dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for o in orders:
        key = o.created_at.strftime("%Y-%m") if o.created_at else "unknown"
        monthly[key]["count"] += 1

    for l in lines:
        if l.is_valid and l.order and l.order.created_at:
            key = l.order.created_at.strftime("%Y-%m")
            monthly[key]["amount"] += (l.quantity_ordered or 0) * (l.unit_price or 0)

    # Prefetch orders for lines (needed above)
    from sqlalchemy.orm import selectinload
    lines_with_orders_result = await db.execute(
        line_query.options(selectinload(OrderLine.order))
    )
    lines_with_orders = lines_with_orders_result.scalars().all()

    monthly2: dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for o in orders:
        key = o.created_at.strftime("%Y-%m") if o.created_at else "unknown"
        monthly2[key]["count"] += 1
    for l in lines_with_orders:
        if l.is_valid and l.order and l.order.created_at:
            key = l.order.created_at.strftime("%Y-%m")
            monthly2[key]["amount"] += (l.quantity_ordered or 0) * (l.unit_price or 0)

    monthly_data = [
        MonthlyData(month=k, count=v["count"], amount=round(v["amount"], 2))
        for k, v in sorted(monthly2.items())
    ][-12:]  # last 12 months

    # Top products
    product_stats: dict[str, dict] = defaultdict(lambda: {
        "description": "", "total_ordered": 0, "total_delivered": 0, "times": 0
    })
    for l in lines:
        if l.matched_sku:
            s = product_stats[l.matched_sku]
            s["description"] = l.matched_description or ""
            s["total_ordered"] += l.quantity_ordered or 0
            s["total_delivered"] += l.quantity_delivered or 0
            s["times"] += 1

    top_products = [
        TopProduct(
            sku=sku,
            description=v["description"],
            total_ordered=round(v["total_ordered"], 2),
            total_delivered=round(v["total_delivered"], 2),
            times_ordered=v["times"],
        )
        for sku, v in sorted(product_stats.items(), key=lambda x: -x[1]["total_ordered"])
    ][:10]

    return ReportSummary(
        total_orders=total_orders,
        open_orders=open_orders,
        completed_orders=completed_orders,
        total_lines=total_lines,
        pending_lines=pending_lines,
        partial_lines=partial_lines,
        completed_lines=completed_lines,
        total_amount=round(total_amount, 2),
        delivered_amount=round(delivered_amount, 2),
        monthly_orders=monthly_data,
        top_products=top_products,
    )
