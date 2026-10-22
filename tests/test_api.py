import pytest
from fastapi.testclient import TestClient

from spend_engine.api import create_app


@pytest.fixture
def client(service):
    return TestClient(create_app(service))


SMS = "ICICI Bank Acct XX234 debited for Rs 349.00 on 21-Oct-26; ZOMATO credited. UPI:629412345680."


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["merchants"] >= 100


def test_categorize(client):
    r = client.post("/categorize", json={"user_id": "u1", "sms": SMS, "sender": "JD-ICICIB"})
    assert r.status_code == 200
    body = r.json()
    assert body["result"] == {"category": "Food", "confidence": 0.92, "layer": "alias", "matched": "Zomato"}
    t = body["transaction"]
    assert (t["amount"], t["amount_paise"], t["direction"], t["txn_date"], t["mode"]) == (
        349.0, 34900, "debit", "2026-10-21", "UPI"
    )


def test_categorize_parse_failure_is_422(client):
    r = client.post("/categorize", json={"user_id": "u1", "sms": "Your OTP is 123456 for Rs.10"})
    assert r.status_code == 422
    assert r.json()["detail"]["reason"] == "not_transactional"


def test_correction_flow(client):
    txn = client.post("/categorize", json={"user_id": "u1", "sms": SMS}).json()
    r = client.post(
        "/corrections", json={"user_id": "u1", "transaction_id": txn["transaction_id"], "category": "Groceries"}
    )
    assert r.status_code == 200 and r.json()["updated_transactions"] == 1

    again = SMS.replace("629412345680", "629412345699")
    body = client.post("/categorize", json={"user_id": "u1", "sms": again}).json()
    assert body["result"]["category"] == "Groceries" and body["result"]["layer"] == "user_override"


def test_correction_validation(client):
    assert client.post("/corrections", json={"user_id": "u1", "category": "Food"}).status_code == 422
    assert client.post("/corrections", json={"user_id": "u1", "category": "Snacks", "merchant": "x"}).status_code == 422
    r = client.post("/corrections", json={"user_id": "u1", "category": "Food", "transaction_id": 999})
    assert r.status_code == 404


def test_summary(client):
    client.post("/categorize", json={"user_id": "u1", "sms": SMS})
    body = client.get("/summary", params={"date": "2026-10-21", "user_id": "u1"}).json()
    assert body["total_spend"] == 349.0 and body["top_category"] == "Food"
    assert body["by_category"] == [{"category": "Food", "amount": 349.0, "percentage": 100.0, "count": 1}]


def test_summary_requires_date(client):
    assert client.get("/summary", params={"user_id": "u1"}).status_code == 422


def test_transactions_list(client):
    client.post("/categorize", json={"user_id": "u1", "sms": SMS})
    other_day = SMS.replace("21-Oct-26", "25-Oct-26").replace("629412345680", "629412345681")
    client.post("/categorize", json={"user_id": "u1", "sms": other_day})
    client.post("/categorize", json={"user_id": "u2", "sms": SMS})

    rows = client.get("/transactions", params={"user_id": "u1", "from": "2026-10-20", "to": "2026-10-25"}).json()
    assert [r["txn_date"] for r in rows] == ["2026-10-25", "2026-10-21"]
    assert rows[1]["category"] == "Food" and rows[1]["amount"] == 349.0 and rows[1]["layer"] == "alias"

    one_day = client.get("/transactions", params={"user_id": "u1", "from": "2026-10-21", "to": "2026-10-21"}).json()
    assert len(one_day) == 1


def test_transactions_range_validation(client):
    params = {"user_id": "u1", "from": "2026-10-21", "to": "2026-10-20"}
    assert client.get("/transactions", params=params).status_code == 422
    params = {"user_id": "u1", "from": "2024-01-01", "to": "2026-01-01"}
    assert client.get("/transactions", params=params).status_code == 422


def test_cors_allows_expo_web_dev_server(client):
    r = client.get("/health", headers={"Origin": "http://localhost:8081"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:8081"
