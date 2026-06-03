from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    ADMIN_NEOGEN = "admin_neogen"
    ELECO = "eleco"


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEW = "review"
    APPROVED = "approved"
    COMPLETED = "completed"
    ERROR = "error"


class LineStatus(str, Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETED = "completed"


class MatchConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ── Users ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole = UserRole.ELECO


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


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


# ── Deliveries ────────────────────────────────────────────────────────────────

class DeliveryCreate(BaseModel):
    quantity_delivered: float
    notes: Optional[str] = None


class DeliveryOut(BaseModel):
    id: str
    order_line_id: str
    quantity_delivered: float
    delivery_date: datetime
    notes: Optional[str] = None
    created_by_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Order Lines ───────────────────────────────────────────────────────────────

class OrderLineOut(BaseModel):
    id: str
    order_id: str
    row_index: Optional[int] = None
    raw_description: Optional[str] = None
    raw_quantity: Optional[str] = None
    raw_price: Optional[str] = None
    matched_sku: Optional[str] = None
    matched_description: Optional[str] = None
    unit_price: Optional[float] = None
    quantity_ordered: float = 0
    quantity_delivered: float = 0
    quantity_pending: float = 0
    confidence: MatchConfidence = MatchConfidence.NONE
    confidence_score: float = 0.0
    match_method: Optional[str] = None
    warnings: List[str] = []
    manually_reviewed: bool = False
    is_valid: bool = False
    line_status: LineStatus = LineStatus.PENDING
    deliveries: List[DeliveryOut] = []

    class Config:
        from_attributes = True


class OrderLineUpdate(BaseModel):
    matched_sku: Optional[str] = None
    matched_description: Optional[str] = None
    quantity_ordered: Optional[float] = None
    unit_price: Optional[float] = None
    manually_reviewed: bool = True


# ── Purchase Orders ────────────────────────────────────────────────────────────

class PurchaseOrderOut(BaseModel):
    id: str
    order_number: Optional[str] = None
    original_filename: str
    status: OrderStatus
    distributor: str
    notes: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    exported_at: Optional[datetime] = None
    parse_errors: List[str] = []
    lines: List[OrderLineOut] = []
    created_by_id: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseOrderSummary(BaseModel):
    id: str
    order_number: Optional[str] = None
    original_filename: str
    status: OrderStatus
    distributor: str
    created_at: datetime
    line_count: int = 0
    lines_pending: int = 0
    lines_completed: int = 0

    class Config:
        from_attributes = True


# ── Processing ────────────────────────────────────────────────────────────────

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


# ── Reports ───────────────────────────────────────────────────────────────────

class MonthlyData(BaseModel):
    month: str
    count: int
    amount: float = 0


class TopProduct(BaseModel):
    sku: str
    description: str
    total_ordered: float
    total_delivered: float
    times_ordered: int


class ReportSummary(BaseModel):
    total_orders: int
    open_orders: int
    completed_orders: int
    total_lines: int
    pending_lines: int
    partial_lines: int
    completed_lines: int
    total_amount: float
    delivered_amount: float
    monthly_orders: List[MonthlyData]
    top_products: List[TopProduct]


TokenResponse.model_rebuild()
