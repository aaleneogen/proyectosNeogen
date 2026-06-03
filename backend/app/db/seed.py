"""
Seed initial data: admin user, eleco user, demo products, demo orders.
Run via: python -m app.db.seed
"""
import asyncio
import uuid
from datetime import datetime, timedelta
import random

from sqlalchemy import select
from app.db.database import AsyncSessionLocal, engine, Base
from app.models.models import (
    User, Product, PurchaseOrder, OrderLine, Delivery,
    UserRole, OrderStatus, LineStatus, MatchConfidence
)
from app.core.security import hash_password


DEMO_PRODUCTS = [
    {"sku": "T-700001234", "description": "Petrifilm EC (E.Coli / Coliformes)", "price": 59.0, "synonyms": ["Petrifilm E.Coli", "EC Petrifilm", "Film EC"]},
    {"sku": "T-700009876", "description": "Petrifilm YM (Levaduras y Mohos)", "price": 42.0, "synonyms": ["Petrifilm Levaduras", "YM Petrifilm", "Film YM"]},
    {"sku": "T-700005555", "description": "Petrifilm AC (Recuento Aerobios)", "price": 38.0, "synonyms": ["Petrifilm Aerobios", "AC Petrifilm", "Film AC"]},
    {"sku": "T-700007777", "description": "Petrifilm Staph Express (Staph. aureus)", "price": 65.0, "synonyms": ["Petrifilm Staph", "Staph Express", "Film STX"]},
    {"sku": "T-700003333", "description": "Petrifilm RSA (Estafilococos)", "price": 55.0, "synonyms": ["Petrifilm RSA", "RSA Film"]},
    {"sku": "T-600001111", "description": "Tiras Neogen Soleris CO2", "price": 120.0, "synonyms": ["Soleris CO2", "Tiras CO2"]},
    {"sku": "T-600002222", "description": "Tiras Neogen Soleris H2S", "price": 130.0, "synonyms": ["Soleris H2S", "Tiras H2S"]},
    {"sku": "T-500001000", "description": "Acumedia Agar PCA (Plate Count Agar)", "price": 85.0, "synonyms": ["PCA Agar", "Agar Cuenta", "Plate Count"]},
    {"sku": "T-500002000", "description": "Acumedia Caldo BHI", "price": 78.0, "synonyms": ["BHI Caldo", "Brain Heart Infusion"]},
    {"sku": "T-400001500", "description": "Revelador ELISA Salmonella Neogen", "price": 220.0, "synonyms": ["ELISA Salmonella", "Kit Salmonella"]},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # ── Users ──────────────────────────────────────────────────────────────
        existing_admin = await db.execute(select(User).where(User.email == "admin@neogen.com"))
        if not existing_admin.scalar_one_or_none():
            admin = User(
                id=str(uuid.uuid4()),
                name="Admin Neogen",
                email="admin@neogen.com",
                password_hash=hash_password("admin123"),
                role=UserRole.ADMIN_NEOGEN,
            )
            eleco_user = User(
                id=str(uuid.uuid4()),
                name="ELECO Comercial",
                email="eleco@eleco.com",
                password_hash=hash_password("eleco123"),
                role=UserRole.ELECO,
            )
            db.add_all([admin, eleco_user])
            await db.commit()
            await db.refresh(admin)
            await db.refresh(eleco_user)
            print("✓ Users created")
        else:
            admin_r = await db.execute(select(User).where(User.email == "admin@neogen.com"))
            admin = admin_r.scalar_one()
            eleco_r = await db.execute(select(User).where(User.email == "eleco@eleco.com"))
            eleco_user = eleco_r.scalar_one_or_none()

        # ── Products ───────────────────────────────────────────────────────────
        for p in DEMO_PRODUCTS:
            existing = await db.execute(select(Product).where(Product.sku == p["sku"]))
            if not existing.scalar_one_or_none():
                db.add(Product(id=str(uuid.uuid4()), **p, is_active=True))
        await db.commit()
        print("✓ Products seeded")

        # ── Demo orders ────────────────────────────────────────────────────────
        existing_orders = await db.execute(select(PurchaseOrder))
        if existing_orders.scalars().first():
            print("✓ Orders already exist, skipping")
            return

        products_r = await db.execute(select(Product))
        products = products_r.scalars().all()

        statuses = [OrderStatus.REVIEW, OrderStatus.APPROVED, OrderStatus.COMPLETED]
        for i in range(6):
            order_date = datetime.utcnow() - timedelta(days=random.randint(1, 90))
            status = statuses[i % len(statuses)]
            order = PurchaseOrder(
                id=str(uuid.uuid4()),
                order_number=f"OC-2024-{i+1:04d}",
                original_filename=f"OC_ELECO_{i+1:03d}.pdf",
                file_type="pdf",
                status=status,
                distributor="ELECO",
                created_by_id=eleco_user.id if eleco_user else None,
                created_at=order_date,
                processed_at=order_date + timedelta(minutes=2),
            )
            db.add(order)
            await db.flush()

            # 3-6 lines per order
            selected_products = random.sample(products, min(random.randint(3, 6), len(products)))
            for j, product in enumerate(selected_products):
                qty_ordered = random.choice([50, 100, 150, 200, 250, 300])
                qty_delivered = 0
                if status == OrderStatus.COMPLETED:
                    qty_delivered = qty_ordered
                elif status == OrderStatus.APPROVED:
                    qty_delivered = random.randint(0, qty_ordered)

                qty_pending = qty_ordered - qty_delivered
                if qty_delivered == 0:
                    line_status = LineStatus.PENDING
                elif qty_pending == 0:
                    line_status = LineStatus.COMPLETED
                else:
                    line_status = LineStatus.PARTIAL

                line = OrderLine(
                    id=str(uuid.uuid4()),
                    order_id=order.id,
                    row_index=j,
                    raw_description=product.description,
                    raw_quantity=str(qty_ordered),
                    raw_price=str(product.price),
                    matched_sku=product.sku,
                    matched_description=product.description,
                    quantity_ordered=qty_ordered,
                    quantity_delivered=qty_delivered,
                    quantity_pending=qty_pending,
                    unit_price=product.price,
                    confidence=MatchConfidence.HIGH,
                    confidence_score=95.0,
                    match_method="exact_description",
                    warnings=[],
                    is_valid=True,
                    line_status=line_status,
                    manually_reviewed=True,
                    product_id=product.id,
                )
                db.add(line)
                await db.flush()

                if qty_delivered > 0:
                    delivery = Delivery(
                        id=str(uuid.uuid4()),
                        order_line_id=line.id,
                        quantity_delivered=qty_delivered,
                        notes="Entrega demo",
                        created_by_id=admin.id,
                        delivery_date=order_date + timedelta(days=random.randint(3, 15)),
                    )
                    db.add(delivery)

        await db.commit()
        print("✓ Demo orders + deliveries seeded")
        print("\n=== Credenciales de acceso ===")
        print("Admin Neogen: admin@neogen.com / admin123")
        print("ELECO:        eleco@eleco.com / eleco123")


if __name__ == "__main__":
    asyncio.run(seed())
