"""SQLite persistence for transactions, per-user overrides and parse failures.

This is the milestone-1 store; the Spring Boot + Postgres service replaces it
later, so the schema is kept deliberately close to what that will need.
"""

from __future__ import annotations

import sqlite3
import threading
from datetime import date, datetime, timezone

from .models import Category, CategoryResult, ParsedTransaction

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT    NOT NULL,
    txn_date      TEXT,
    amount_paise  INTEGER NOT NULL,
    direction     TEXT    NOT NULL,
    merchant      TEXT,
    vpa           TEXT,
    account_last4 TEXT,
    ref_no        TEXT,
    mode          TEXT    NOT NULL,
    template_id   TEXT,
    rules_version TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    confidence    REAL    NOT NULL,
    layer         TEXT    NOT NULL,
    matched       TEXT,
    raw_sms       TEXT,
    created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_txn_user_date ON transactions (user_id, txn_date);
CREATE INDEX IF NOT EXISTS ix_txn_user_ref ON transactions (user_id, ref_no);

CREATE TABLE IF NOT EXISTS overrides (
    user_id    TEXT NOT NULL,
    key        TEXT NOT NULL,
    category   TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS parse_failures (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT,
    sender        TEXT,
    sms           TEXT NOT NULL,
    reason        TEXT NOT NULL,
    rules_version TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: str = ":memory:"):
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._db.executescript(SCHEMA)

    # --------------------------------------------------------- transactions

    def find_duplicate(self, user_id: str, txn: ParsedTransaction) -> sqlite3.Row | None:
        """Banks sometimes send the same alert twice; a matching reference
        number, amount and direction means it is the same transaction."""
        if not txn.ref_no:
            return None
        with self._lock:
            return self._db.execute(
                "SELECT * FROM transactions WHERE user_id = ? AND ref_no = ?"
                " AND amount_paise = ? AND direction = ?",
                (user_id, txn.ref_no, txn.amount_paise, txn.direction.value),
            ).fetchone()

    def add_transaction(
        self, user_id: str, txn: ParsedTransaction, result: CategoryResult, raw_sms: str | None
    ) -> int:
        with self._lock, self._db:
            cur = self._db.execute(
                "INSERT INTO transactions (user_id, txn_date, amount_paise, direction, merchant, vpa,"
                " account_last4, ref_no, mode, template_id, rules_version, category, confidence,"
                " layer, matched, raw_sms, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    user_id,
                    txn.txn_date.isoformat() if txn.txn_date else None,
                    txn.amount_paise,
                    txn.direction.value,
                    txn.merchant,
                    txn.vpa,
                    txn.account_last4,
                    txn.ref_no,
                    txn.mode.value,
                    txn.template_id,
                    txn.rules_version,
                    result.category.value,
                    result.confidence,
                    result.layer.value,
                    result.matched,
                    raw_sms,
                    _now(),
                ),
            )
            return int(cur.lastrowid)

    def get_transaction(self, user_id: str, txn_id: int) -> sqlite3.Row | None:
        with self._lock:
            return self._db.execute(
                "SELECT * FROM transactions WHERE id = ? AND user_id = ?", (txn_id, user_id)
            ).fetchone()

    def transactions_on(self, user_id: str, day: date) -> list[sqlite3.Row]:
        with self._lock:
            return self._db.execute(
                "SELECT * FROM transactions WHERE user_id = ? AND txn_date = ? ORDER BY id",
                (user_id, day.isoformat()),
            ).fetchall()

    def transactions_between(self, user_id: str, start: date, end: date) -> list[sqlite3.Row]:
        """Transactions dated ``start``..``end`` inclusive, newest first."""
        with self._lock:
            return self._db.execute(
                "SELECT * FROM transactions WHERE user_id = ? AND txn_date BETWEEN ? AND ?"
                " ORDER BY txn_date DESC, id DESC",
                (user_id, start.isoformat(), end.isoformat()),
            ).fetchall()

    def user_transactions(self, user_id: str) -> list[sqlite3.Row]:
        with self._lock:
            return self._db.execute(
                "SELECT * FROM transactions WHERE user_id = ? ORDER BY id", (user_id,)
            ).fetchall()

    def recategorize(self, user_id: str, txn_ids: list[int], category: Category) -> int:
        """Stamp a user-chosen category on the given transactions."""
        if not txn_ids:
            return 0
        marks = ", ".join("?" for _ in txn_ids)
        with self._lock, self._db:
            cur = self._db.execute(
                "UPDATE transactions SET category = ?, confidence = 1.0, layer = 'user_override',"
                f" matched = NULL WHERE user_id = ? AND id IN ({marks})",
                (category.value, user_id, *txn_ids),
            )
            return cur.rowcount

    # ------------------------------------------------------------ overrides

    def set_override(self, user_id: str, key: str, category: Category) -> None:
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO overrides (user_id, key, category, updated_at) VALUES (?, ?, ?, ?)"
                " ON CONFLICT (user_id, key) DO UPDATE SET category = excluded.category,"
                " updated_at = excluded.updated_at",
                (user_id, key, category.value, _now()),
            )

    def overrides_for(self, user_id: str) -> dict[str, Category]:
        with self._lock:
            rows = self._db.execute(
                "SELECT key, category FROM overrides WHERE user_id = ?", (user_id,)
            ).fetchall()
        return {r["key"]: Category(r["category"]) for r in rows}

    # ------------------------------------------------------- parse failures

    def log_parse_failure(
        self, user_id: str | None, sender: str | None, sms: str, reason: str, rules_version: str
    ) -> None:
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO parse_failures (user_id, sender, sms, reason, rules_version, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, sender, sms, reason, rules_version, _now()),
            )

    def parse_failures(self, limit: int = 100) -> list[sqlite3.Row]:
        with self._lock:
            return self._db.execute(
                "SELECT * FROM parse_failures ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
