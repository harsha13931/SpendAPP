"""Accuracy gate: categorization must stay at or above 85% on every labeled
split. The blind split (holdout2) is the number to trust."""

from pathlib import Path

import pytest

from spend_engine.evaluate import evaluate, load_cases

DATA = Path(__file__).parent / "data"
TARGET = 0.85


@pytest.mark.parametrize("split", ["labeled_dev", "labeled_holdout1", "labeled_holdout2"])
def test_category_accuracy(parser, categorizer, split):
    report = evaluate(split, load_cases(DATA / f"{split}.yaml"), parser, categorizer)
    assert report.category_total >= 40
    assert report.category_accuracy >= TARGET, "\n".join(report.misses)
    assert report.reject_hits == report.reject_total, "\n".join(report.misses)
    # Amount and direction feed the daily summary directly.
    for field in ("amount", "direction"):
        assert report.field_hits[field] / report.field_total[field] >= 0.95


def test_dataset_ids_unique():
    ids = [c["id"] for p in DATA.glob("labeled_*.yaml") for c in load_cases(p)]
    assert len(ids) == len(set(ids))
