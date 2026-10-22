"""Layered transaction categorizer.

Layers run highest-confidence first and the first hit wins:

    user override -> credit => Income -> VPA lookup -> merchant alias
    -> fuzzy alias (Levenshtein) -> keyword rules -> Other

Every result carries the category, a confidence in [0, 1] and the layer that
produced it, so the app can show "auto-tagged" vs "you tagged this" and ask
for confirmation on low-confidence results.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from importlib import resources
from pathlib import Path

import yaml

from .fuzzy import levenshtein
from .models import Category, CategoryResult, Direction, Layer
from .normalize import compact, normalize, tokens

CONFIDENCE = {
    Layer.USER_OVERRIDE: 1.0,
    Layer.DIRECTION: 0.9,
    Layer.VPA: 0.98,  # exact handle; prefix hits are scaled down below
    Layer.ALIAS: 0.92,
    Layer.FUZZY: 0.8,  # scaled by similarity
    Layer.KEYWORD: 0.6,
    Layer.FALLBACK: 0.2,
}

# Shortest alias the fuzzy layer will consider. At five letters one edit
# already turns "from a" into "croma", so shorter aliases are exact-only.
MIN_FUZZY_LEN = 6
# Shortest alias allowed as a substring of a compacted merchant/VPA token.
MIN_SUBSTRING_LEN = 5


@dataclass(frozen=True)
class Merchant:
    name: str
    category: Category


@dataclass(frozen=True)
class _Alias:
    tokens: tuple[str, ...]
    compact: str
    merchant: Merchant


def override_keys(merchant: str | None, vpa: str | None) -> list[str]:
    """Keys under which a user correction is stored and looked up.

    A VPA identifies the payee exactly, so it is preferred; the normalised
    merchant string is the fallback for card and NEFT transactions.
    """
    keys = []
    if vpa:
        keys.append(f"vpa:{vpa.strip().lower()}")
    if merchant and normalize(merchant):
        keys.append(f"merchant:{normalize(merchant)}")
    return keys


def _max_edits(length: int) -> int:
    # Tight on purpose: "bluedart" is two edits from "blusmart".
    return 1 if length <= 8 else 2 if length <= 12 else 3


class Categorizer:
    def __init__(self, merchants: list[dict], keywords: dict[str, list[str]]):
        self._vpas: dict[str, Merchant] = {}
        aliases: list[_Alias] = []
        for row in merchants:
            m = Merchant(row["name"], Category(row["category"]))
            for vpa in row.get("vpas", []):
                self._vpas[vpa.lower()] = m
            for alias in [row["name"], *row.get("aliases", [])]:
                toks = tuple(tokens(alias))
                if toks:
                    aliases.append(_Alias(toks, "".join(toks), m))
        # Longest first so "swiggy instamart" is tried before "swiggy".
        self._aliases = sorted(
            {(a.tokens, a.merchant.name): a for a in aliases}.values(),
            key=lambda a: (-len(a.compact), a.compact),
        )
        self._keywords: list[tuple[Category, list[tuple[str, ...]]]] = [
            (Category(cat), [tuple(tokens(k)) for k in words]) for cat, words in keywords.items()
        ]

    @classmethod
    def from_files(
        cls, merchants_path: str | Path | None = None, keywords_path: str | Path | None = None
    ) -> "Categorizer":
        def load(path: str | Path | None, default: str) -> dict:
            if path is None:
                text = resources.files("spend_engine.data").joinpath(default).read_text("utf-8")
            else:
                text = Path(path).read_text("utf-8")
            return yaml.safe_load(text)

        merchants = load(merchants_path, "merchants.yaml")["merchants"]
        keywords = load(keywords_path, "keywords.yaml")["categories"]
        return cls(merchants, keywords)

    @property
    def merchant_count(self) -> int:
        return len({a.merchant.name for a in self._aliases})

    # ------------------------------------------------------------------ API

    def categorize(
        self,
        merchant: str | None,
        vpa: str | None = None,
        direction: Direction = Direction.DEBIT,
        overrides: Mapping[str, Category] | None = None,
    ) -> CategoryResult:
        if overrides:
            for key in override_keys(merchant, vpa):
                if key in overrides:
                    return CategoryResult(
                        category=overrides[key],
                        confidence=CONFIDENCE[Layer.USER_OVERRIDE],
                        layer=Layer.USER_OVERRIDE,
                        matched=key.split(":", 1)[1],
                    )

        if direction == Direction.CREDIT:
            return CategoryResult(
                category=Category.INCOME,
                confidence=CONFIDENCE[Layer.DIRECTION],
                layer=Layer.DIRECTION,
                matched=merchant or vpa,
            )

        for layer in (self._by_vpa, self._by_alias, self._by_fuzzy, self._by_keyword):
            result = layer(merchant, vpa)
            if result:
                return result

        return CategoryResult(
            category=Category.OTHER, confidence=CONFIDENCE[Layer.FALLBACK], layer=Layer.FALLBACK
        )

    # --------------------------------------------------------------- layers

    def _by_vpa(self, merchant: str | None, vpa: str | None) -> CategoryResult | None:
        if not vpa:
            return None
        vpa = vpa.strip().lower()
        if vpa in self._vpas:
            m = self._vpas[vpa]
            return CategoryResult(
                category=m.category, confidence=CONFIDENCE[Layer.VPA], layer=Layer.VPA, matched=m.name
            )
        # Handle local part: "bigbasket.payu@hdfcbank" -> ["bigbasket", "payu"].
        local = vpa.split("@", 1)[0]
        parts = {p for p in re.split(r"[^a-z0-9]+", local) if p}
        parts |= {p for p in re.split(r"[^a-z]+", local) if p}
        for alias in self._aliases:
            if len(alias.tokens) != 1:
                if alias.compact in parts:
                    return self._vpa_hit(alias, 0.95)
                continue
            for part in parts:
                if part == alias.compact:
                    return self._vpa_hit(alias, 0.95)
                if (
                    len(alias.compact) >= MIN_SUBSTRING_LEN
                    and part.startswith(alias.compact)
                    and len(part) - len(alias.compact) <= 6
                ):
                    return self._vpa_hit(alias, 0.9)
        return None

    @staticmethod
    def _vpa_hit(alias: _Alias, confidence: float) -> CategoryResult:
        return CategoryResult(
            category=alias.merchant.category,
            confidence=confidence,
            layer=Layer.VPA,
            matched=alias.merchant.name,
        )

    def _by_alias(self, merchant: str | None, vpa: str | None) -> CategoryResult | None:
        if not merchant:
            return None
        toks = tokens(merchant)
        if not toks:
            return None
        joined = "".join(toks)
        for alias in self._aliases:
            n = len(alias.tokens)
            phrase_hit = any(tuple(toks[i : i + n]) == alias.tokens for i in range(len(toks) - n + 1))
            if phrase_hit or (len(alias.compact) >= MIN_SUBSTRING_LEN and alias.compact in joined):
                return CategoryResult(
                    category=alias.merchant.category,
                    confidence=CONFIDENCE[Layer.ALIAS],
                    layer=Layer.ALIAS,
                    matched=alias.merchant.name,
                )
        return None

    def _by_fuzzy(self, merchant: str | None, vpa: str | None) -> CategoryResult | None:
        if not merchant:
            return None
        toks = tokens(merchant)
        # Candidate strings: every window of 1-3 consecutive tokens, compacted.
        windows = {
            "".join(toks[i : i + n]) for n in (1, 2, 3) for i in range(len(toks) - n + 1)
        }
        best: tuple[float, _Alias] | None = None
        for alias in self._aliases:
            if len(alias.compact) < MIN_FUZZY_LEN:
                continue
            limit = _max_edits(len(alias.compact))
            for w in windows:
                if abs(len(w) - len(alias.compact)) > limit:
                    continue
                d = levenshtein(w, alias.compact, limit)
                if d <= limit:
                    sim = 1 - d / max(len(w), len(alias.compact))
                    if best is None or sim > best[0]:
                        best = (sim, alias)
        if best is None:
            return None
        sim, alias = best
        return CategoryResult(
            category=alias.merchant.category,
            confidence=round(CONFIDENCE[Layer.FUZZY] * sim, 3),
            layer=Layer.FUZZY,
            matched=alias.merchant.name,
        )

    def _by_keyword(self, merchant: str | None, vpa: str | None) -> CategoryResult | None:
        toks = tokens(merchant or "") + (tokens(vpa.split("@", 1)[0]) if vpa else [])
        if not toks:
            return None
        best: tuple[int, int, Category, str] | None = None
        for rank, (category, phrases) in enumerate(self._keywords):
            hits = [" ".join(p) for p in phrases if _phrase_in(p, toks)]
            if hits and (best is None or len(hits) > best[0]):
                best = (len(hits), rank, category, hits[0])
        if best is None:
            return None
        return CategoryResult(
            category=best[2],
            confidence=CONFIDENCE[Layer.KEYWORD],
            layer=Layer.KEYWORD,
            matched=best[3],
        )


def _phrase_in(phrase: tuple[str, ...], toks: list[str]) -> bool:
    n = len(phrase)
    if n == 0:
        return False
    for i in range(len(toks) - n + 1):
        window = toks[i : i + n]
        if all(w == p or w == p + "s" for w, p in zip(window, phrase)):
            return True
    return False
