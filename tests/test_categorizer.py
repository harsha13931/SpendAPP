import pytest

from spend_engine.models import Category, Direction, Layer


def test_seed_has_about_100_merchants(categorizer):
    assert categorizer.merchant_count >= 100


@pytest.mark.parametrize(
    "merchant, vpa, category, layer",
    [
        (None, "swiggy@icici", Category.FOOD, Layer.VPA),
        (None, "bigbasket.payu@hdfcbank", Category.GROCERIES, Layer.VPA),
        (None, "zee5@axisbank", Category.ENTERTAINMENT, Layer.VPA),
        ("ZOMATO LTD", None, Category.FOOD, Layer.ALIAS),
        ("AIRTEL POSTPAID", None, Category.BILLS, Layer.ALIAS),
        ("NACH ACH-DR NETFLIX ENTERTAINMENT", None, Category.ENTERTAINMENT, Layer.ALIAS),
        ("SWIGY", None, Category.FOOD, Layer.FUZZY),
        ("FLIPKRT INTERNET", None, Category.SHOPPING, Layer.FUZZY),
        ("SRI SAI MEDICALS", None, Category.HEALTH, Layer.KEYWORD),
        ("GREEN LEAF CAFE", None, Category.FOOD, Layer.KEYWORD),
        ("RAJESH KUMAR", None, Category.OTHER, Layer.FALLBACK),
        (None, None, Category.OTHER, Layer.FALLBACK),
    ],
)
def test_layers(categorizer, merchant, vpa, category, layer):
    r = categorizer.categorize(merchant, vpa)
    assert (r.category, r.layer) == (category, layer)


def test_confidence_falls_with_each_layer(categorizer):
    conf = [
        categorizer.categorize(None, "swiggy@icici").confidence,
        categorizer.categorize("ZOMATO").confidence,
        categorizer.categorize("SWIGY").confidence,
        categorizer.categorize("GREEN LEAF CAFE").confidence,
        categorizer.categorize("RAJESH KUMAR").confidence,
    ]
    assert conf == sorted(conf, reverse=True)
    assert all(0 <= c <= 1 for c in conf)


def test_longest_alias_wins(categorizer):
    assert categorizer.categorize("SWIGGY INSTAMART").category is Category.GROCERIES
    assert categorizer.categorize("AMAZON PRIME VIDEO").category is Category.ENTERTAINMENT
    assert categorizer.categorize("AMAZON FRESH").category is Category.GROCERIES
    assert categorizer.categorize("AMAZON").category is Category.SHOPPING


def test_short_aliases_are_not_fuzzy_matched(categorizer):
    # One edit from "croma"; five-letter aliases are exact-only.
    assert categorizer.categorize("FROMA").layer is not Layer.FUZZY


def test_vpa_beats_merchant(categorizer):
    r = categorizer.categorize("GREEN LEAF CAFE", vpa="uber@axisbank")
    assert (r.category, r.layer) == (Category.TRANSPORT, Layer.VPA)


def test_credits_are_income(categorizer):
    r = categorizer.categorize("ACME TECHNOLOGIES", direction=Direction.CREDIT)
    assert (r.category, r.layer) == (Category.INCOME, Layer.DIRECTION)


def test_override_beats_every_layer(categorizer):
    overrides = {"vpa:swiggy@icici": Category.OTHER, "merchant:acme technologies": Category.OTHER}
    r = categorizer.categorize("SWIGGY", "swiggy@icici", overrides=overrides)
    assert (r.category, r.layer, r.confidence) == (Category.OTHER, Layer.USER_OVERRIDE, 1.0)
    # ...including the credit => Income rule.
    r = categorizer.categorize("Acme Technologies Pvt Ltd", direction=Direction.CREDIT, overrides=overrides)
    assert r.layer is Layer.USER_OVERRIDE
