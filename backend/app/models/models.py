from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, JSON, func
)
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db.database import Base


def gen_uuid():
    return str(uuid.uuid4())


# ── Enums ──────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN_NEOGEN = "admin_neogen"
    ELECO = "eleco"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEW = "review"
    APPROVED = "approved"
    COMPLETED = "completed"
    ERROR = "error"


class LineStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETED = "completed"


class MatchConfidence(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


# ── Users ──────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(500), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.ELECO)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    orders = relationship("PurchaseOrder", back_populates="creator")
    deliveries = relationship("Delivery", back_populates="created_by_user")


# ── Products ──────────────────────────────────────────────────────────────────

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


# ── Purchase Orders ───────────────────────────────────────────────────────────

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    order_number = Column(String(100), index=True)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000))
    file_type = Column(String(10))
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    distributor = Column(String(100), default="ELECO")
    raw_text = Column(Text)
    parse_errors = Column(JSON, default=list)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    processed_at = Column(DateTime)
    exported_at = Column(DateTime)
    export_path = Column(String(1000))
    created_by_id = Column(String, ForeignKey("users.id"), nullable=True)

    creator = relationship("User", back_populates="orders")
    lines = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")


# ── Order Lines ───────────────────────────────────────────────────────────────

class OrderLine(Base):
    __tablename__ = "order_lines"

    id = Column(String, primary_key=True, default=gen_uuid)
    order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=False)
    row_index = Column(Integer)

    # Raw parsed data
    raw_description = Column(String(500))
    raw_quantity = Column(String(50))
    raw_price = Column(String(50))

    # Matched / confirmed data
    matched_sku = Column(String(100))
    matched_description = Column(String(500))
    unit_price = Column(Float)

    # Quantities
    quantity_ordered = Column(Float, default=0)
    quantity_delivered = Column(Float, default=0)
    quantity_pending = Column(Float, default=0)

    # Matching metadata
    confidence = Column(Enum(MatchConfidence), default=MatchConfidence.NONE)
    confidence_score = Column(Float, default=0.0)
    match_method = Column(String(50))
    warnings = Column(JSON, default=list)

    # Status
    line_status = Column(Enum(LineStatus), default=LineStatus.PENDING)
    manually_reviewed = Column(Boolean, default=False)
    is_valid = Column(Boolean, default=False)

    product_id = Column(String, ForeignKey("products.id"), nullable=True)
    matched_product = relationship("Product", back_populates="order_lines")
    order = relationship("PurchaseOrder", back_populates="lines")
    deliveries = relationship("Delivery", back_populates="order_line", cascade="all, delete-orphan")


# ── Deliveries ────────────────────────────────────────────────────────────────

class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(String, primary_key=True, default=gen_uuid)
    order_line_id = Column(String, ForeignKey("order_lines.id"), nullable=False)
    quantity_delivered = Column(Float, nullable=False)
    delivery_date = Column(DateTime, server_default=func.now())
    notes = Column(Text)
    created_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    order_line = relationship("OrderLine", back_populates="deliveries")
    created_by_user = relationship("User", back_populates="deliveries")
