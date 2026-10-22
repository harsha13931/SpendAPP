"""Run a fictional day of SMS through the engine and print the transactions
and the daily summary as JSON (used for the design prototype's sample data).

    python scripts/demo_day.py
"""

import json
from datetime import date

from spend_engine.service import SpendService

DAY = [
    "Rs.85000.00 credited to HDFC Bank A/c XX1234 on 21-10-26 by NEFT-ACME TECHNOLOGIES PVT LTD (Ref No. N274261234567)",
    "Sent Rs.149.00 from Kotak Bank AC X7890 to rapido.ride@axisbank on 21-10-26.UPI Ref 629412345685.",
    "ICICI Bank Acct XX234 debited for Rs 60.00 on 21-Oct-26; GANESH TEA STALL credited. UPI:629412345606.",
    "INR 2,340.00 spent using ICICI Bank Card XX9012 on 21-Oct-26 on BIGBASKET. Avl Limit: INR 1,20,000.00.",
    "Sent Rs.412.00 From HDFC Bank A/C *1234 To Zomato Ltd On 21/10/26 Ref 629412345601",
    "Spent Rs.1,499.00 On HDFC Bank Card 5678 At AMAZON PAY INDIA On 2026-10-21:19:42:10.",
    "INR 199.00 debited A/c no. XX3456 21-10-26, 08:15:22 UPI/P2M/629412345684/NETFLIX COM",
    "Spent Rs.875.00 On HDFC Bank Card 5678 At SRI SAI MEDICALS On 2026-10-21:21:15:00.",
    "Sent Rs.1500.00 From HDFC Bank A/C *1234 To IRON PARADISE On 21/10/26 Ref 629400000002",
    "Received Rs.1,200.00 in your Kotak Bank AC X7890 from priya.s@okhdfcbank on 21-10-26.UPI Ref:629412345686.",
]

svc = SpendService.default()
txns = []
for sms in DAY:
    out = svc.categorize_sms("demo", sms)
    t = out.parsed
    txns.append(
        {
            "id": out.transaction_id,
            # Dictionary layers name the merchant; keyword hits name the keyword.
            "merchant": (
                out.result.matched
                if out.result.layer.value in ("vpa", "alias", "fuzzy")
                else t.merchant or t.vpa
            ),
            "amount": t.amount,
            "direction": t.direction.value,
            "mode": t.mode.value,
            "category": out.result.category.value,
            "confidence": out.result.confidence,
            "layer": out.result.layer.value,
        }
    )
print(json.dumps({"transactions": txns, "summary": svc.summary("demo", date(2026, 10, 21)).model_dump(mode="json")}, indent=1))
