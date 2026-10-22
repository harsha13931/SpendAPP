# SPEND

Android-first personal finance for India. SPEND reads bank and UPI alerts,
auto-categorises each payment and shows a daily income-vs-spend summary.

This repository holds the categorisation engine (milestone 1, a Python
package with a FastAPI service) and the first version of the React Native
Android app in [`app/`](app/README.md). See [`docs/PLAN.md`](docs/PLAN.md) for the
roadmap, the Google Play SMS-policy finding, and the UX design.

## How to run

**Step-by-step guide: [`docs/RUNNING.md`](docs/RUNNING.md)** covers the phone
(Expo Go), emulator and browser, connecting the app to the engine, and
troubleshooting.

The short version:

```bash
git clone https://github.com/harsha13931/SpendAPP.git && cd SpendAPP

# App with sample data: scan the QR code with Expo Go on your phone
cd app && npm install && npx expo start

# Engine for live mode, in a second terminal from the repo root
pip install -e ".[dev]"
SPEND_DB=spend.db uvicorn spend_engine.api:app --host 0.0.0.0 --port 8000
```

## Engine quick start

```bash
pip install -e ".[dev]"
pytest                                   # unit tests + 85% accuracy gate
uvicorn spend_engine.api:app --reload    # http://127.0.0.1:8000/docs
```

Set `SPEND_DB=spend.db` to persist data between restarts. The default is
in-memory. `SPEND_CORS_ORIGINS` lists browser origins allowed to call the
API; the default is the Expo web dev server, `http://localhost:8081`.

```bash
curl -s -X POST localhost:8000/categorize -H 'content-type: application/json' -d '{
  "user_id": "demo",
  "sms": "Sent Rs.85.00 from Kotak Bank AC X7890 to rapido.ride@axisbank on 21-10-26.UPI Ref 629412345685."
}'
# → result: {"category": "Transport", "confidence": 0.98, "layer": "vpa", "matched": "Rapido"}

curl -s -X POST localhost:8000/corrections -H 'content-type: application/json' \
  -d '{"user_id": "demo", "transaction_id": 1, "category": "Bills"}'

curl -s 'localhost:8000/summary?date=2026-10-21&user_id=demo'
```

| Endpoint | Purpose |
|---|---|
| `POST /categorize` | Parse one SMS, categorise it, store it (deduplicated by ref no.) |
| `POST /corrections` | Re-tag a transaction or payee. Stored as a per-user override that beats every other layer |
| `GET /summary?date=&user_id=` | Income, spend, net, spend by category with %, top category |
| `GET /transactions?user_id=&from=&to=` | Stored transactions in a date range, newest first |
| `GET /health`, `GET /categories` | Rules version, merchant count, category list |

## Layout

```
src/spend_engine/
  parser.py          rule-driven SMS parser (no bank regex in code)
  categorizer.py     override → credit⇒Income → VPA → alias → fuzzy → keyword → Other
  fuzzy.py           Levenshtein
  store.py           SQLite: transactions, overrides, parse_failures
  service.py         parse → categorise → store; corrections; summaries
  summary.py         daily summary
  api.py             FastAPI app
  evaluate.py        accuracy report over labeled sets
  data/
    sms_rules.v1.yaml  versioned bank formats and field extractors
    merchants.yaml     123 seeded Indian merchants and billers
    keywords.yaml      keyword fallback rules
tests/
  data/labeled_*.yaml  183 fictional labeled SMS (dev, holdout-1, blind holdout-2)
reports/accuracy.md    generated accuracy report
design/project/        UX design canvas source
docs/PLAN.md           plan, policy check, design notes
app/                   React Native (Expo) app, see app/README.md
```

## Adding a bank format

Add a template (or a generic extractor) to `src/spend_engine/data/sms_rules.v1.yaml`,
bump `version`, and add labeled examples to `tests/data/`. Then regenerate the
report:

```bash
python -m spend_engine.evaluate tests/data/labeled_dev.yaml \
  tests/data/labeled_holdout1.yaml tests/data/labeled_holdout2.yaml \
  --report reports/accuracy.md
```

All sample SMS in this repository are fictional. Never commit real bank
messages, account numbers or credentials.
