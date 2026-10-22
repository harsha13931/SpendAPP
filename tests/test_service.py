from datetime import date

import pytest

from spend_engine.models import Category, Layer
from spend_engine.parser import ParseError

U = "u1"
SWIGGY = "Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 21/10/26 Ref 629400000001"
GYM = "Sent Rs.1500.00 From HDFC Bank A/C *1234 To IRON PARADISE On 21/10/26 Ref 629400000002"
GYM_AGAIN = "Sent Rs.1500.00 From HDFC Bank A/C *1234 To Iron Paradise On 22/10/26 Ref 629400000003"
SALARY = "Rs.50000.00 credited to HDFC Bank A/c XX1234 on 21-10-26 by NEFT-ACME CORP (Ref No. N2742600001)"


def test_categorize_persists(service):
    out = service.categorize_sms(U, SWIGGY)
    assert out.transaction_id and not out.duplicate
    assert out.result.category is Category.FOOD


def test_duplicate_sms_is_stored_once(service):
    first = service.categorize_sms(U, SWIGGY)
    second = service.categorize_sms(U, SWIGGY)
    assert second.duplicate and second.transaction_id == first.transaction_id
    assert len(service.store.user_transactions(U)) == 1


def test_parse_failures_are_recorded(service):
    with pytest.raises(ParseError):
        service.categorize_sms(U, "Your statement is ready", sender="VM-HDFCBK")
    [row] = service.store.parse_failures()
    assert (row["reason"], row["sender"]) == ("no_amount", "VM-HDFCBK")


def test_correction_becomes_override_for_future_and_past(service):
    first = service.categorize_sms(U, GYM)
    assert first.result.category is Category.OTHER

    keys, updated = service.correct(U, Category.HEALTH, transaction_id=first.transaction_id)
    assert keys == ["merchant:iron paradise"] and updated == 1
    assert service.store.get_transaction(U, first.transaction_id)["category"] == "Health"

    # Different case/punctuation, same payee: the override applies.
    later = service.categorize_sms(U, GYM_AGAIN)
    assert (later.result.category, later.result.layer) == (Category.HEALTH, Layer.USER_OVERRIDE)


def test_correction_beats_dictionary(service):
    service.correct(U, Category.GROCERIES, merchant="Swiggy")
    assert service.categorize_sms(U, SWIGGY).result.category is Category.GROCERIES


def test_apply_to_past(service):
    a = service.categorize_sms(U, GYM)
    b = service.categorize_sms(U, GYM_AGAIN)
    _, updated = service.correct(U, Category.HEALTH, transaction_id=b.transaction_id)
    assert updated == 2
    assert service.store.get_transaction(U, a.transaction_id)["layer"] == "user_override"


def test_overrides_are_per_user(service):
    service.correct("alice", Category.SHOPPING, merchant="Swiggy")
    assert service.categorize_sms("bob", SWIGGY).result.category is Category.FOOD


def test_summary(service):
    service.categorize_sms(U, SWIGGY)
    service.categorize_sms(U, GYM)
    service.categorize_sms(U, SALARY)
    service.categorize_sms(U, GYM_AGAIN)  # other day
    s = service.summary(U, date(2026, 10, 21))
    assert (s.total_income, s.total_spend, s.net, s.transaction_count) == (50000.0, 1750.0, 48250.0, 3)
    assert [(c.category, c.amount, c.percentage) for c in s.by_category] == [
        (Category.OTHER, 1500.0, 85.7),
        (Category.FOOD, 250.0, 14.3),
    ]
    assert s.top_category is Category.OTHER


def test_empty_summary(service):
    s = service.summary(U, date(2026, 1, 1))
    assert (s.total_spend, s.by_category, s.top_category) == (0.0, [], None)


def test_correcting_a_payee_less_transfer_retags_only_it(service):
    sms = "Your a/c no. XXXXXXXX4321 is debited for Rs.560.00 on 21-10-2026 and credited to a/c no. XXXXXXXX9988 (UPI Ref no 629400000009)"
    out = service.categorize_sms(U, sms)
    assert out.parsed.merchant is None and out.parsed.vpa is None
    keys, updated = service.correct(U, Category.BILLS, transaction_id=out.transaction_id)
    assert (keys, updated) == ([], 1)
    assert service.store.overrides_for(U) == {}
