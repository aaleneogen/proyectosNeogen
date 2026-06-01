from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, JSON, func
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEW = "review"
    COMPLETED = "completed"
    ERROR = "error"


class MatchConfidence(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_uuid)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=False)
    price = Column(Float, nullable=False)
    synonyms = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    order_lines = relationship("OrderLine", back_populates="matched_product")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000))
    file_type = Column(String(10))
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    distributor = Column(String(100), default="ELECO")
    raw_text = Column(Text)
    parse_errors = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())
    processed_at = Column(DateTime)
    exported_at = Column(DateTime)
    export_path = Column(String(1000))
    created_by = Column(String(100))

    lines = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")


class OrderLine(Base):
    __tablename__ = "order_lines"

    id = Column(String, primary_key=True, default=gen_uuid)
    order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=False)
    row_index = Column(Integer)

    raw_description = Column(String(500))
    raw_quantity = Column(String(50))
    raw_price = Column(String(50))

    matched_sku = Column(String(100))
    matched_description = Column(String(500))
    quantity = Column(Float)
    unit_price = Column(Float)

    confidence = Column(Enum(MatchConfidence), default=MatchConfidence.NONE)
    confidence_score = Column(Float, default=0.0)
    match_method = Column(String(50))
    warnings = Column(JSON, default=list)

    manually_reviewed = Column(Boolean, default=False)
    is_valid = Column(Boolean, default=False)

    product_id = Column(String, ForeignKey("products.id"), nullable=True)
    matched_product = relationship("Product", back_populates="order_lines")
    order = relationship("PurchaseOrder", back_populates="lines")
