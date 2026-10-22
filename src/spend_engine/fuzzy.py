"""Levenshtein edit distance, implemented here to keep the engine free of
native dependencies (it must also run inside the mobile build later)."""

from __future__ import annotations


def levenshtein(a: str, b: str, max_distance: int | None = None) -> int:
    """Edit distance between ``a`` and ``b``.

    With ``max_distance`` set, returns ``max_distance + 1`` as soon as the
    distance is known to exceed it, which keeps dictionary scans cheap.
    """
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    if max_distance is not None and len(a) - len(b) > max_distance:
        return max_distance + 1
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(
                min(
                    previous[j] + 1,  # deletion
                    current[j - 1] + 1,  # insertion
                    previous[j - 1] + (ca != cb),  # substitution
                )
            )
        if max_distance is not None and min(current) > max_distance:
            return max_distance + 1
        previous = current
    return previous[-1]


def similarity(a: str, b: str) -> float:
    """1.0 for identical strings, 0.0 for completely different ones."""
    longest = max(len(a), len(b))
    if longest == 0:
        return 1.0
    return 1.0 - levenshtein(a, b) / longest
