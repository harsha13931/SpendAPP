from __future__ import annotations

import re

# Corporate suffixes and filler that never help identify a merchant.
STOPWORDS = frozenset(
    {"pvt", "private", "ltd", "limited", "llp", "inc", "co", "corp", "www", "com", "in", "the", "m", "s"}
)


def tokens(text: str) -> list[str]:
    words = re.sub(r"[^a-z0-9]+", " ", text.lower()).split()
    return [w for w in words if w not in STOPWORDS]


def normalize(text: str) -> str:
    return " ".join(tokens(text))


def compact(text: str) -> str:
    return normalize(text).replace(" ", "")
