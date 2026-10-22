import logging
from datetime import date, datetime

import pytest

from spend_engine.models import Direction, PaymentMode
from spend_engine.parser import ParseError, SmsParser

HDFC_UPI = (
    "Sent Rs.1,250.50\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 21/10/26\nRef 629412345678\n"
    "Not You?\nCall 1800-000-0000/SMS BLOCK UPI to 90000XXXXX"
)


def test_extracts_every_field(parser):
    t = parser.parse(HDFC_UPI)
    assert t.amount_paise == 125050
    assert t.amount == 1250.50
    assert t.direction is Direction.DEBIT
    assert t.merchant == "SWIGGY"
    assert t.account_last4 == "1234"
    assert t.txn_date == date(2026, 10, 21)
    assert t.ref_no == "629412345678"
    assert t.mode is PaymentMode.UPI
    assert t.rules_version == parser.version


def test_template_fields_and_id(parser):
    t = parser.parse(
        "Dear UPI user A/C X5678 debited by 120.0 on date 21Oct26 trf to RAPIDO Refno 629412345682. -SBI"
    )
    assert t.template_id == "sbi_upi_debit_v1"
    assert (t.amount_paise, t.merchant, t.account_last4, t.ref_no) == (12000, "RAPIDO", "5678", "629412345682")
    assert t.txn_date == date(2026, 10, 21)


def test_vpa_target_is_not_a_merchant(parser):
    t = parser.parse("Sent Rs.95.00 from Kotak Bank AC X7890 to vijay.chai@okaxis on 02-10-26.UPI Ref 629500000037.")
    assert t.vpa == "vijay.chai@okaxis"
    assert t.merchant is None


def test_footer_is_not_mined_for_merchants(parser):
    # Only "to" is the helpline footer; it must not become the merchant.
    t = parser.parse("Rs.500.00 debited from A/c XX1234 on 01-10-26. Not you? SMS BLOCK to 90000XXXXX")
    assert t.merchant is None


@pytest.mark.parametrize(
    "sms, direction",
    [
        ("ICICI Bank Acct XX234 debited for Rs 349.00 on 21-Oct-26; ZOMATO credited. UPI:629412345680.", Direction.DEBIT),
        ("Rs.320.00 Dr. from A/C XXXXXX2468 thru UPI/629500000001 to SWIGGY on 21-10-26.", Direction.DEBIT),
        ("Rs.42,000.00 Cr. to A/C XXXXXX2468 thru NEFT from INITECH on 01-10-26.", Direction.CREDIT),
        ("Received Rs.2500.00 in your Kotak Bank AC X7890 from amit.v@okhdfcbank on 21-10-26.", Direction.CREDIT),
    ],
)
def test_earliest_direction_keyword_wins(parser, sms, direction):
    assert parser.parse(sms).direction is direction


@pytest.mark.parametrize(
    "raw, paise",
    [("Rs.1,05,000.00", 10500000), ("INR 99", 9900), ("Rs:270.00", 27000), ("₹ 49.5", 4950)],
)
def test_indian_amount_formats(parser, raw, paise):
    assert parser.parse(f"{raw} debited from A/c XX1234 on 01-10-26").amount_paise == paise


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("21-10-26", date(2026, 10, 21)),
        ("21/10/2026", date(2026, 10, 21)),
        ("2026-10-21", date(2026, 10, 21)),
        ("21-Oct-26", date(2026, 10, 21)),
        ("21Oct26", date(2026, 10, 21)),
    ],
)
def test_date_formats(parser, raw, expected):
    assert parser.parse(f"Rs.10.00 debited from A/c XX1234 on {raw}").txn_date == expected


def test_received_at_is_the_date_fallback(parser):
    t = parser.parse("Rs.10.00 debited from A/c XX1234", received_at=datetime(2026, 10, 22, 9, 30))
    assert t.txn_date == date(2026, 10, 22)


@pytest.mark.parametrize(
    "sms, mode",
    [
        ("Rs.2000.00 withdrawn at ATM S1AB0123 from A/c X5678 on 18Oct26.", PaymentMode.ATM),
        ("INR 649.00 debited on 05-10-26 towards NACH ACH-DR NETFLIX.", PaymentMode.NACH),
        ("Spent Rs.10.00 On HDFC Bank Card 5678 At CROMA On 2026-10-21", PaymentMode.CARD),
        ("Rs.10.00 credited to A/c XX1 by NEFT-ACME (Ref No. N1234567)", PaymentMode.NEFT),
        ("Sent Rs.10.00 to shop@okaxis on 01-10-26", PaymentMode.UPI),
    ],
)
def test_payment_mode(parser, sms, mode):
    assert parser.parse(sms).mode is mode


@pytest.mark.parametrize(
    "sms",
    [
        "123456 is the OTP for txn of Rs.2,500.00 at AMAZON. Do not share.",
        "ravi.n@okaxis has requested Rs.300.00 from you on UPI.",
        "Your A/c will be debited with Rs.649.00 on 05-11-26 towards NETFLIX mandate.",
        "Your UPI transaction of Rs.500.00 to SWIGGY has failed.",
    ],
)
def test_non_transactional_messages_are_rejected(parser, sms):
    with pytest.raises(ParseError) as e:
        parser.parse(sms)
    assert e.value.reason == "not_transactional"


def test_failures_are_logged(parser, caplog):
    with caplog.at_level(logging.WARNING, logger="spend_engine.parser"):
        with pytest.raises(ParseError) as e:
            parser.parse("Your account statement for October is ready.")
    assert e.value.reason == "no_amount"
    assert "no_amount" in caplog.text and parser.version in caplog.text


def test_rules_are_data(tmp_path):
    """A new bank format ships as a rules edit, with no code change."""
    rules = tmp_path / "rules.yaml"
    base = SmsParser.from_file()
    import yaml
    from importlib import resources

    data = yaml.safe_load(resources.files("spend_engine.data").joinpath("sms_rules.v1.yaml").read_text())
    data["version"] = "test.1"
    data["templates"].insert(
        0,
        {
            "id": "fictional_bank_v1",
            "bank": "Fictional",
            "direction": "debit",
            "sender": "FICTBK",
            "pattern": r"FB: (?P<amount>[\d.]+) paid to (?P<merchant>\w+)",
        },
    )
    rules.write_text(yaml.safe_dump(data, allow_unicode=True))
    custom = SmsParser.from_file(rules)

    t = custom.parse("FB: 42.00 paid to Netflix", sender="AD-FICTBK")
    assert (t.template_id, t.rules_version, t.merchant, t.amount_paise) == ("fictional_bank_v1", "test.1", "Netflix", 4200)
    # Sender filter: other senders skip the template, and the generic rules
    # find no currency-marked amount.
    with pytest.raises(ParseError):
        custom.parse("FB: 42.00 paid to Netflix", sender="AD-OTHER")
    assert base.version != "test.1"
