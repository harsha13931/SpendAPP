"""FastAPI service.

Run locally:  uvicorn spend_engine.api:app --reload
Set SPEND_DB to a file path to persist between restarts (default: in-memory).
Set SPEND_CORS_ORIGINS to a comma-separated list of origins allowed to call
the API from a browser (default: Expo's web dev server, http://localhost:8081).
"""

from __future__ import annotations

import os
from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from .models import Category, CategoryResult, ParsedTransaction
from .parser import ParseError
from .service import SpendService, TransactionNotFound
from .summary import DailySummary


class CategorizeRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    sms: str = Field(min_length=1, max_length=2000)
    sender: str | None = Field(None, max_length=32, description="SMS sender ID, e.g. VM-HDFCBK")
    received_at: datetime | None = Field(None, description="Used as the date when the SMS has none")
    persist: bool = True


class CategorizeResponse(BaseModel):
    transaction_id: int | None
    duplicate: bool
    transaction: ParsedTransaction
    result: CategoryResult


class CorrectionRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    category: Category
    transaction_id: int | None = None
    merchant: str | None = None
    vpa: str | None = None
    apply_to_past: bool = True

    @model_validator(mode="after")
    def _needs_target(self):
        if self.transaction_id is None and not (self.merchant or self.vpa):
            raise ValueError("give transaction_id, or merchant/vpa")
        return self


class CorrectionResponse(BaseModel):
    override_keys: list[str]
    updated_transactions: int


class TransactionRecord(BaseModel):
    """A stored transaction as the app lists it."""

    id: int
    txn_date: date | None
    amount: float
    amount_paise: int
    direction: str
    merchant: str | None
    vpa: str | None
    account_last4: str | None
    ref_no: str | None
    mode: str
    category: Category
    confidence: float
    layer: str
    matched: str | None
    created_at: str

    @classmethod
    def from_row(cls, row) -> "TransactionRecord":
        data = {k: row[k] for k in row.keys() if k in cls.model_fields}
        return cls(**data, amount=row["amount_paise"] / 100)


def create_app(service: SpendService | None = None) -> FastAPI:
    app = FastAPI(title="SPEND categorization engine", version="0.1.0")
    origins = os.environ.get("SPEND_CORS_ORIGINS", "http://localhost:8081")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins.split(",") if o.strip()],
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
    )
    svc = service or SpendService.default(os.environ.get("SPEND_DB", ":memory:"))

    def get_service() -> SpendService:
        return svc

    @app.get("/health")
    def health(s: SpendService = Depends(get_service)) -> dict:
        return {
            "status": "ok",
            "rules_version": s.parser.version,
            "merchants": s.categorizer.merchant_count,
        }

    @app.get("/categories")
    def categories() -> list[str]:
        return [c.value for c in Category]

    @app.post("/categorize", response_model=CategorizeResponse)
    def categorize(req: CategorizeRequest, s: SpendService = Depends(get_service)):
        try:
            out = s.categorize_sms(req.user_id, req.sms, req.sender, req.received_at, req.persist)
        except ParseError as e:
            raise HTTPException(
                status_code=422,
                detail={"error": "parse_failed", "reason": e.reason, "rules_version": e.rules_version},
            )
        return CategorizeResponse(
            transaction_id=out.transaction_id,
            duplicate=out.duplicate,
            transaction=out.parsed,
            result=out.result,
        )

    @app.post("/corrections", response_model=CorrectionResponse)
    def corrections(req: CorrectionRequest, s: SpendService = Depends(get_service)):
        try:
            keys, updated = s.correct(
                req.user_id,
                req.category,
                transaction_id=req.transaction_id,
                merchant=req.merchant,
                vpa=req.vpa,
                apply_to_past=req.apply_to_past,
            )
        except TransactionNotFound:
            raise HTTPException(status_code=404, detail="transaction not found")
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        return CorrectionResponse(override_keys=keys, updated_transactions=updated)

    @app.get("/transactions", response_model=list[TransactionRecord])
    def transactions(
        user_id: str = Query(..., min_length=1, max_length=64),
        start: date = Query(..., alias="from", description="First day, YYYY-MM-DD"),
        end: date = Query(..., alias="to", description="Last day (inclusive), YYYY-MM-DD"),
        s: SpendService = Depends(get_service),
    ):
        if end < start:
            raise HTTPException(status_code=422, detail="'to' is before 'from'")
        if (end - start).days > 366:
            raise HTTPException(status_code=422, detail="range is longer than a year")
        return [TransactionRecord.from_row(r) for r in s.store.transactions_between(user_id, start, end)]

    @app.get("/summary", response_model=DailySummary)
    def summary(
        date: date = Query(..., description="Day to summarise, YYYY-MM-DD"),
        user_id: str = Query(..., min_length=1, max_length=64),
        s: SpendService = Depends(get_service),
    ):
        return s.summary(user_id, date)

    return app


app = create_app()
