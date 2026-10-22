"""Daily income-vs-spend summary."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date

from pydantic import BaseModel

from .models import Category


class CategorySpend(BaseModel):
    category: Category
    amount: float
    percentage: float
    count: int


class DailySummary(BaseModel):
    date: date
    user_id: str
    total_income: float
    total_spend: float
    net: float
    transaction_count: int
    by_category: list[CategorySpend]
    top_category: Category | None


def daily_summary(user_id: str, day: date, rows: Iterable[Mapping]) -> DailySummary:
    """Summarise one day of transactions.

    Income is every credit, spend is every debit; ``by_category`` breaks the
    spend down, sorted largest first, with percentages of total spend. A
    debit the user re-tagged as Income still counts as spend (money left the
    account) but is listed under Income in the breakdown.
    """
    income = spend = count = 0
    per_cat: dict[Category, list[int]] = {}
    for r in rows:
        count += 1
        if r["direction"] == "credit":
            income += r["amount_paise"]
            continue
        spend += r["amount_paise"]
        bucket = per_cat.setdefault(Category(r["category"]), [0, 0])
        bucket[0] += r["amount_paise"]
        bucket[1] += 1

    ranked = sorted(per_cat.items(), key=lambda kv: (-kv[1][0], kv[0].value))
    by_category = [
        CategorySpend(
            category=cat,
            amount=paise / 100,
            percentage=round(100 * paise / spend, 1) if spend else 0.0,
            count=n,
        )
        for cat, (paise, n) in ranked
    ]
    return DailySummary(
        date=day,
        user_id=user_id,
        total_income=income / 100,
        total_spend=spend / 100,
        net=(income - spend) / 100,
        transaction_count=count,
        by_category=by_category,
        top_category=by_category[0].category if by_category else None,
    )
