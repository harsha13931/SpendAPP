from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field, computed_field


class Category(str, Enum):
    FOOD = "Food"
    GROCERIES = "Groceries"
    TRANSPORT = "Transport"
    SHOPPING = "Shopping"
    BILLS = "Bills"
    ENTERTAINMENT = "Entertainment"
    HEALTH = "Health"
    INCOME = "Income"
    OTHER = "Other"


class Direction(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"


class PaymentMode(str, Enum):
    UPI = "UPI"
    CARD = "CARD"
    ATM = "ATM"
    NACH = "NACH"
    NEFT = "NEFT"
    IMPS = "IMPS"
    RTGS = "RTGS"
    NETBANKING = "NETBANKING"
    UNKNOWN = "UNKNOWN"


class Layer(str, Enum):
    """Which categorizer layer produced a result, highest confidence first."""

    USER_OVERRIDE = "user_override"
    DIRECTION = "direction"
    VPA = "vpa"
    ALIAS = "alias"
    FUZZY = "fuzzy"
    KEYWORD = "keyword"
    FALLBACK = "fallback"


class ParsedTransaction(BaseModel):
    amount_paise: int = Field(gt=0, description="Amount in paise to avoid float rounding")
    direction: Direction
    merchant: str | None = None
    vpa: str | None = None
    account_last4: str | None = None
    txn_date: date | None = None
    ref_no: str | None = None
    mode: PaymentMode = PaymentMode.UNKNOWN
    template_id: str | None = Field(None, description="Bank template used, or None for generic")
    rules_version: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def amount(self) -> float:
        """Amount in rupees, for display."""
        return self.amount_paise / 100


class CategoryResult(BaseModel):
    category: Category
    confidence: float = Field(ge=0.0, le=1.0)
    layer: Layer
    matched: str | None = Field(None, description="Merchant, VPA or keyword that matched")
