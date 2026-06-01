import io
import uuid
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db.database import get_db
from app.models.models import Product
from app.schemas.schemas import ProductCreate, ProductUpdate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[ProductOut])
async def list_products(active_only: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(Product).order_by(Product.sku)
    if active_only:
        query = query.where(Product.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=ProductOut, status_code=201)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Product).where(Product.sku == data.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"SKU {data.sku} already exists")
    product = Product(id=str(uuid.uuid4()), **data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, data: ProductUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    product.is_active = False
    await db.commit()


@router.post("/import", response_model=dict)
async def import_products(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    filename = file.filename or ""

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Cannot parse file: {e}")

    df.columns = [str(c).strip().upper() for c in df.columns]

    required = {"SKU", "DESCRIPCION", "PRECIO"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(400, f"Missing required columns: {missing}")

    created = 0
    updated = 0
    errors = []

    for _, row in df.iterrows():
        try:
            sku = str(row["SKU"]).strip()
            description = str(row["DESCRIPCION"]).strip()
            price = float(str(row["PRECIO"]).replace(",", "."))
            synonyms = []
            if "SINONIMOS" in df.columns and pd.notna(row.get("SINONIMOS")):
                synonyms = [s.strip() for s in str(row["SINONIMOS"]).split("|") if s.strip()]

            if not sku or not description:
                continue

            existing = await db.execute(select(Product).where(Product.sku == sku))
            product = existing.scalar_one_or_none()

            if product:
                product.description = description
                product.price = price
                product.synonyms = synonyms
                product.is_active = True
                updated += 1
            else:
                db.add(Product(
                    id=str(uuid.uuid4()),
                    sku=sku,
                    description=description,
                    price=price,
                    synonyms=synonyms,
                    is_active=True,
                ))
                created += 1

        except Exception as e:
            errors.append(f"Row error: {e}")

    await db.commit()
    return {"created": created, "updated": updated, "errors": errors}
