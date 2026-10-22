import pytest

from spend_engine.fuzzy import levenshtein, similarity


@pytest.mark.parametrize(
    "a, b, d",
    [("", "", 0), ("abc", "", 3), ("kitten", "sitting", 3), ("swiggy", "swigy", 1), ("flipkart", "flipkrt", 1)],
)
def test_levenshtein(a, b, d):
    assert levenshtein(a, b) == d == levenshtein(b, a)


def test_levenshtein_cutoff():
    assert levenshtein("bigbasket", "netflix", max_distance=2) == 3


def test_similarity():
    assert similarity("zomato", "zomato") == 1.0
    assert similarity("swiggy", "swigy") == pytest.approx(5 / 6)
