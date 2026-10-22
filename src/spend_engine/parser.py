"""Rule-driven parser for Indian bank / UPI transaction SMS.

The parser itself knows no bank formats: every regex comes from a versioned
rules file (``data/sms_rules.v1.yaml`` by default). Parsing runs in three
steps:

1. Drop messages that match an ``ignore`` rule (OTPs, collect requests,
   pre-debit notices...).
2. Try bank ``templates`` in order; the first match supplies whatever fields
   it captures.
3. Fill the remaining fields with the generic ``fields`` extractors.

A message without an amount or a direction raises :class:`ParseError`, and
every failure is logged to the ``spend_engine.parser`` logger.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from importlib import resources
from pathlib import Path
from typing import Any

import yaml

from .models import Direction, ParsedTransaction, PaymentMode

log = logging.getLogger("spend_engine.parser")

DEFAULT_RULES = "sms_rules.v1.yaml"
_FLAGS = re.IGNORECASE | re.DOTALL


class ParseError(ValueError):
    def __init__(self, reason: str, sms: str, rules_version: str):
        super().__init__(reason)
        self.reason = reason
        self.sms = sms
        self.rules_version = rules_version


@dataclass(frozen=True)
class _Template:
    id: str
    bank: str
    pattern: re.Pattern[str]
    sender: re.Pattern[str] | None
    direction: Direction | None
    mode: PaymentMode | None


@dataclass(frozen=True)
class _DateRule:
    pattern: re.Pattern[str]
    formats: tuple[str, ...]


def _compile(patterns: list[str]) -> list[re.Pattern[str]]:
    return [re.compile(p, _FLAGS) for p in patterns]


class SmsParser:
    def __init__(self, rules: dict[str, Any]):
        self.version: str = str(rules["version"])
        self._ignore = _compile(rules.get("ignore", []))
        self._footer = _compile(rules.get("footer", []))
        self._templates = [
            _Template(
                id=t["id"],
                bank=t.get("bank", ""),
                pattern=re.compile(t["pattern"], _FLAGS),
                sender=re.compile(t["sender"], re.IGNORECASE) if t.get("sender") else None,
                direction=Direction(t["direction"]) if t.get("direction") else None,
                mode=PaymentMode(t["mode"]) if t.get("mode") else None,
            )
            for t in rules.get("templates", [])
        ]
        f = rules["fields"]
        self._amount = _compile(f["amount"])
        self._debit = _compile(f["direction"]["debit"])
        self._credit = _compile(f["direction"]["credit"])
        self._account = _compile(f["account"])
        self._vpa = _compile(f["vpa"])
        self._ref = _compile(f["ref"])
        self._dates = [
            _DateRule(re.compile(d["pattern"], _FLAGS), tuple(d["formats"])) for d in f["date"]
        ]
        self._merchant = _compile(f["merchant"])
        self._merchant_reject = _compile(f.get("merchant_reject", []))
        self._modes = [(PaymentMode(m["mode"]), re.compile(m["pattern"], _FLAGS)) for m in f["mode"]]

    @classmethod
    def from_file(cls, path: str | Path | None = None) -> "SmsParser":
        if path is None:
            text = resources.files("spend_engine.data").joinpath(DEFAULT_RULES).read_text("utf-8")
        else:
            text = Path(path).read_text("utf-8")
        return cls(yaml.safe_load(text))

    # ------------------------------------------------------------------ API

    def parse(
        self, sms: str, sender: str | None = None, received_at: datetime | None = None
    ) -> ParsedTransaction:
        text = " ".join(sms.split())
        if not text:
            raise self._fail("empty_message", sms)
        if any(p.search(text) for p in self._ignore):
            raise self._fail("not_transactional", sms)

        fields: dict[str, Any] = {}
        template_id = None
        for t in self._templates:
            if t.sender and not (sender and t.sender.search(sender)):
                continue
            m = t.pattern.search(text)
            if not m:
                continue
            template_id = t.id
            fields = {k: v for k, v in m.groupdict().items() if v}
            if t.direction:
                fields["direction"] = t.direction
            if t.mode:
                fields["mode"] = t.mode
            break

        body = self._strip_footer(text)
        amount = self._to_paise(fields.get("amount")) or self._extract_amount(text)
        if not amount:
            raise self._fail("no_amount", sms)
        direction = self._direction(fields.get("direction")) or self._extract_direction(text)
        if direction is None:
            raise self._fail("no_direction", sms)

        vpa = fields.get("vpa") or self._first(self._vpa, body)
        merchant = self._clean_merchant(fields.get("merchant")) or self._extract_merchant(body, vpa)
        if merchant and "@" in merchant:
            vpa = vpa or merchant.lower()
            merchant = None
        account = fields.get("account") or self._first(self._account, text)
        txn_date = self._to_date(fields.get("date")) or self._extract_date(text)
        if txn_date is None and received_at is not None:
            txn_date = received_at.date()

        return ParsedTransaction(
            amount_paise=amount,
            direction=direction,
            merchant=merchant,
            vpa=vpa.lower() if vpa else None,
            account_last4=account[-4:] if account else None,
            txn_date=txn_date,
            ref_no=fields.get("ref") or self._first(self._ref, text),
            mode=fields.get("mode") or self._extract_mode(text, vpa),
            template_id=template_id,
            rules_version=self.version,
        )

    # ------------------------------------------------------------ internals

    def _fail(self, reason: str, sms: str) -> ParseError:
        log.warning("sms parse failed: reason=%s rules=%s sms=%r", reason, self.version, sms[:200])
        return ParseError(reason, sms, self.version)

    def _strip_footer(self, text: str) -> str:
        cut = len(text)
        for p in self._footer:
            m = p.search(text)
            if m:
                cut = min(cut, m.start())
        return text[:cut]

    @staticmethod
    def _first(patterns: list[re.Pattern[str]], text: str) -> str | None:
        for p in patterns:
            m = p.search(text)
            if m:
                return next(g for g in m.groups() if g)
        return None

    @staticmethod
    def _to_paise(raw: str | None) -> int | None:
        if not raw:
            return None
        try:
            value = Decimal(raw.replace(",", ""))
        except InvalidOperation:
            return None
        paise = int((value * 100).quantize(Decimal("1")))
        return paise if paise > 0 else None

    def _extract_amount(self, text: str) -> int | None:
        for p in self._amount:
            for m in p.finditer(text):
                paise = self._to_paise(m.group(1))
                if paise:
                    return paise
        return None

    @staticmethod
    def _direction(value: Any) -> Direction | None:
        if value is None:
            return None
        if isinstance(value, Direction):
            return value
        return Direction.DEBIT if str(value).lower().startswith("debit") else Direction.CREDIT

    def _extract_direction(self, text: str) -> Direction | None:
        best: tuple[int, Direction] | None = None
        for direction, patterns in ((Direction.DEBIT, self._debit), (Direction.CREDIT, self._credit)):
            for p in patterns:
                m = p.search(text)
                if m and (best is None or m.start() < best[0]):
                    best = (m.start(), direction)
        return best[1] if best else None

    def _clean_merchant(self, raw: str | None) -> str | None:
        if not raw:
            return None
        name = re.sub(r"^(?:vpa|m/s\.?|mr\.?|ms\.?)\s+", "", raw.strip(), flags=re.IGNORECASE)
        name = name.strip(" .,;:-/()'\"")
        name = " ".join(name.split())
        if len(name) < 2 or any(p.search(name) for p in self._merchant_reject):
            return None
        return name

    def _extract_merchant(self, body: str, vpa: str | None) -> str | None:
        candidates: list[tuple[int, str]] = []
        lowered = body.lower()
        for p in self._merchant:
            for m in p.finditer(body):
                # "to vijay.chai@okaxis" names a VPA, not a merchant.
                if vpa and lowered.startswith(vpa.lower(), m.start(1)):
                    continue
                name = self._clean_merchant(m.group(1))
                if name:
                    candidates.append((m.start(1), name))
                    break
        return min(candidates)[1] if candidates else None

    @staticmethod
    def _parse_date(raw: str, formats: tuple[str, ...]) -> date | None:
        compact = raw.strip()
        for fmt in formats:
            try:
                return datetime.strptime(compact, fmt).date()
            except ValueError:
                continue
        return None

    def _to_date(self, raw: str | None) -> date | None:
        if not raw:
            return None
        for rule in self._dates:
            if rule.pattern.fullmatch(raw):
                parsed = self._parse_date(raw, rule.formats)
                if parsed:
                    return parsed
        return None

    def _extract_date(self, text: str) -> date | None:
        for rule in self._dates:
            for m in rule.pattern.finditer(text):
                parsed = self._parse_date(m.group(1), rule.formats)
                if parsed:
                    return parsed
        return None

    def _extract_mode(self, text: str, vpa: str | None) -> PaymentMode:
        for mode, p in self._modes:
            if p.search(text):
                return mode
        return PaymentMode.UPI if vpa else PaymentMode.UNKNOWN
