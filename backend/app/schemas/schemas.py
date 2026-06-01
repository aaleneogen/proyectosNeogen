from pydantic import BaseModel, Field, validator
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class MatchConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEW = "review"
    COMPLETED = "completed"
    ERROR = "error"


# ── Products ──────────────────────────────────────────────────────────────────

class ProductBase(BaseModel):
    sku: str
    description: str
    price: float
    synonyms: List[str] = []
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    description: Optional[str] = None
    price: Optional[float] = None
    synonyms: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ProductOut(ProductBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Order Lines ───────────────────────────────────────────────────────────────

class OrderLineBase(BaseModel):
    raw_description: Optional[str] = None
    raw_quantity: Optional[str] = None
    raw_price: Optional[str] = None
    matched_sku: Optional[str] = None
    matched_description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    confidence: MatchConfidence = MatchConfidence.NONE
    confidence_score: float = 0.0
    match_method: Optional[str] = None
    warnings: List[str] = []
    manually_reviewed: bool = False
    is_valid: bool = False


class OrderLineOut(OrderLineBase):
    id: str
    order_id: str
    row_index: Optional[int] = None

    class Config:
        from_attributes = True


class OrderLineUpdate(BaseModel):
    matched_sku: Optional[str] = None
    matched_description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    manually_reviewed: bool = True


# ── Purchase Orders ────────────────────────────────────────────────────────────

class PurchaseOrderOut(BaseModel):
    id: str
    original_filename: str
    status: OrderStatus
    distributor: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    exported_at: Optional[datetime] = None
    parse_errors: List[str] = []
    lines: List[OrderLineOut] = []

    class Config:
        from_attributes = True


class PurchaseOrderSummary(BaseModel):
    id: str
    original_filename: str
    status: OrderStatus
    distributor: str
    created_at: datetime
    line_count: int = 0

    class Config:
        from_attributes = True


# ── Processing Results ────────────────────────────────────────────────────────

class ParsedRow(BaseModel):
    description: str
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    raw_quantity: Optional[str] = None
    raw_price: Optional[str] = None


class ProcessingResult(BaseModel):
    order_id: str
    status: OrderStatus
    lines_detected: int
    lines_matched: int
    lines_needs_review: int
    parse_errors: List[str] = []
