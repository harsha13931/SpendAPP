"""Accuracy evaluation against a labeled SMS set.

    python -m spend_engine.evaluate tests/data/labeled_dev.yaml [more.yaml ...] \
        --report reports/accuracy.md
"""

from __future__ import annotations

import argparse
import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import yaml

from .categorizer import Categorizer
from .parser import ParseError, SmsParser

PARSE_FIELDS = ("amount", "direction", "account", "vpa", "date", "ref", "mode")


@dataclass
class Report:
    name: str
    total: int = 0
    category_hits: int = 0
    category_total: int = 0
    reject_hits: int = 0
    reject_total: int = 0
    field_hits: Counter = field(default_factory=Counter)
    field_total: Counter = field(default_factory=Counter)
    layers: Counter = field(default_factory=Counter)
    confusion: Counter = field(default_factory=Counter)
    misses: list[str] = field(default_factory=list)

    @property
    def category_accuracy(self) -> float:
        return self.category_hits / self.category_total if self.category_total else 0.0

    @property
    def overall_accuracy(self) -> float:
        """Category accuracy where a correctly rejected non-transaction counts
        as a hit and a missed rejection counts as a miss."""
        n = self.category_total + self.reject_total
        return (self.category_hits + self.reject_hits) / n if n else 0.0


def _actual(txn, name: str):
    return {
        "amount": round(txn.amount, 2),
        "direction": txn.direction.value,
        "account": txn.account_last4,
        "vpa": txn.vpa,
        "date": txn.txn_date,
        "ref": txn.ref_no,
        "mode": txn.mode.value,
    }[name]


def _expected(value, name: str):
    if name == "amount":
        return round(float(value), 2)
    if name == "date" and not isinstance(value, date):
        return date.fromisoformat(str(value))
    if name in ("account", "ref"):
        return str(value)
    if name == "vpa":
        return str(value).lower()
    return value


def evaluate(name: str, cases: list[dict], parser: SmsParser, categorizer: Categorizer) -> Report:
    r = Report(name)
    for case in cases:
        r.total += 1
        expect = case["expect"]
        try:
            txn = parser.parse(case["sms"], sender=case.get("sender"))
        except ParseError as e:
            if expect == "none":
                r.reject_total += 1
                r.reject_hits += 1
            else:
                r.category_total += 1
                r.misses.append(f"{case['id']}: parse failed ({e.reason}), expected {expect['category']}")
            continue

        if expect == "none":
            r.reject_total += 1
            r.misses.append(f"{case['id']}: should have been rejected as non-transactional")
            continue

        for f in PARSE_FIELDS:
            if f in expect:
                r.field_total[f] += 1
                got, want = _actual(txn, f), _expected(expect[f], f)
                if got == want:
                    r.field_hits[f] += 1
                else:
                    r.misses.append(f"{case['id']}: {f} = {got!r}, expected {want!r}")

        res = categorizer.categorize(txn.merchant, txn.vpa, txn.direction)
        r.category_total += 1
        r.layers[res.layer.value] += 1
        r.confusion[(expect["category"], res.category.value)] += 1
        if res.category.value == expect["category"]:
            r.category_hits += 1
        else:
            r.misses.append(
                f"{case['id']}: category {res.category.value} via {res.layer.value}"
                f" (merchant={txn.merchant!r}, vpa={txn.vpa!r}), expected {expect['category']}"
            )
    return r


def _wilson_low(hits: int, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    p = hits / n
    denom = 1 + z * z / n
    centre = p + z * z / (2 * n)
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (centre - margin) / denom


def to_markdown(reports: list[Report], rules_version: str, target: float) -> str:
    out = ["# SPEND categorization accuracy report", ""]
    out.append(f"Rules version `{rules_version}`. Target: {target:.0%} category accuracy.")
    out.append("")
    out.append(
        "All messages are fictional and hand-written. Only a split that was scored before any"
        " rule change counts as a blind estimate; each dataset file's header records whether"
        " rules were tuned against it. The 95% lower bound is a Wilson interval: with ~45"
        " messages per split, read accuracy as a range, not a point."
    )
    out.append("")
    out.append("| Split | Messages | Category accuracy | 95% lower bound | Non-txn rejected | Overall | Target met |")
    out.append("|---|---|---|---|---|---|---|")
    for r in reports:
        out.append(
            f"| {r.name} | {r.total} | {r.category_hits}/{r.category_total} = {r.category_accuracy:.1%}"
            f" | {_wilson_low(r.category_hits, r.category_total):.1%}"
            f" | {r.reject_hits}/{r.reject_total} | {r.overall_accuracy:.1%}"
            f" | {'yes' if r.category_accuracy >= target else 'NO'} |"
        )
    for r in reports:
        out += ["", f"## {r.name}", "", "### Parse field accuracy", "", "| Field | Correct |", "|---|---|"]
        for f in PARSE_FIELDS:
            if r.field_total[f]:
                out.append(f"| {f} | {r.field_hits[f]}/{r.field_total[f]} ({r.field_hits[f] / r.field_total[f]:.0%}) |")
        out += ["", "### Matching layer", "", "| Layer | Transactions |", "|---|---|"]
        for layer, n in r.layers.most_common():
            out.append(f"| {layer} | {n} |")
        out += ["", "### Misses", ""]
        out += [f"- {m}" for m in r.misses] or ["- none"]
    out.append("")
    return "\n".join(out)


def load_cases(path: str | Path) -> list[dict]:
    return yaml.safe_load(Path(path).read_text("utf-8"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("datasets", nargs="+")
    ap.add_argument("--report", help="write a markdown report here")
    ap.add_argument("--target", type=float, default=0.85)
    args = ap.parse_args(argv)

    parser, categorizer = SmsParser.from_file(), Categorizer.from_files()
    reports = [evaluate(Path(p).stem, load_cases(p), parser, categorizer) for p in args.datasets]
    md = to_markdown(reports, parser.version, args.target)
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(md, "utf-8")
    print(md)
    return 0 if all(r.category_accuracy >= args.target for r in reports) else 1


if __name__ == "__main__":
    raise SystemExit(main())
