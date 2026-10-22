"""Glue between parser, categorizer and store. The API layer is a thin
wrapper over this, so the same flow can be driven from tests or scripts."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from .categorizer import Categorizer, override_keys
from .models import Category, CategoryResult, ParsedTransaction
from .parser import ParseError, SmsParser
from .store import Store
from .summary import DailySummary, daily_summary


@dataclass
class Categorized:
    transaction_id: int | None
    parsed: ParsedTransaction
    result: CategoryResult
    duplicate: bool = False


class TransactionNotFound(LookupError):
    pass


class SpendService:
    def __init__(self, parser: SmsParser, categorizer: Categorizer, store: Store):
        self.parser = parser
        self.categorizer = categorizer
        self.store = store

    @classmethod
    def default(cls, db_path: str = ":memory:") -> "SpendService":
        return cls(SmsParser.from_file(), Categorizer.from_files(), Store(db_path))

    def categorize_sms(
        self,
        user_id: str,
        sms: str,
        sender: str | None = None,
        received_at: datetime | None = None,
        persist: bool = True,
    ) -> Categorized:
        try:
            parsed = self.parser.parse(sms, sender=sender, received_at=received_at)
        except ParseError as e:
            self.store.log_parse_failure(user_id, sender, sms, e.reason, e.rules_version)
            raise

        if persist:
            dup = self.store.find_duplicate(user_id, parsed)
            if dup is not None:
                return Categorized(dup["id"], parsed, _result_from_row(dup), duplicate=True)

        result = self.categorizer.categorize(
            parsed.merchant, parsed.vpa, parsed.direction, self.store.overrides_for(user_id)
        )
        txn_id = self.store.add_transaction(user_id, parsed, result, sms) if persist else None
        return Categorized(txn_id, parsed, result)

    def correct(
        self,
        user_id: str,
        category: Category,
        *,
        transaction_id: int | None = None,
        merchant: str | None = None,
        vpa: str | None = None,
        apply_to_past: bool = True,
    ) -> tuple[list[str], int]:
        """Record a user re-tag as an override for that payee.

        Returns the override keys written and how many stored transactions
        were updated.
        """
        if transaction_id is not None:
            row = self.store.get_transaction(user_id, transaction_id)
            if row is None:
                raise TransactionNotFound(transaction_id)
            merchant, vpa = row["merchant"], row["vpa"]
        keys = override_keys(merchant, vpa)
        if not keys and transaction_id is None:
            raise ValueError("a correction needs a transaction_id, merchant or vpa")
        # A transaction with no payee (a/c-to-a/c transfer) is re-tagged alone.
        for key in keys:
            self.store.set_override(user_id, key, category)

        ids: list[int] = [transaction_id] if transaction_id is not None else []
        if apply_to_past and keys:
            wanted = set(keys)
            ids += [
                r["id"]
                for r in self.store.user_transactions(user_id)
                if r["id"] not in ids and wanted & set(override_keys(r["merchant"], r["vpa"]))
            ]
        return keys, self.store.recategorize(user_id, ids, category)

    def summary(self, user_id: str, day: date) -> DailySummary:
        return daily_summary(user_id, day, self.store.transactions_on(user_id, day))


def _result_from_row(row) -> CategoryResult:
    return CategoryResult(
        category=row["category"], confidence=row["confidence"], layer=row["layer"], matched=row["matched"]
    )
