# SPEND: product and delivery plan

SPEND is an Android-first personal finance app for India. It reads bank and
UPI transaction alerts, categorises every payment and shows a daily
income-vs-spend summary by category.

Categories: Food, Groceries, Transport, Shopping, Bills, Entertainment,
Health, Income, Other.

## 1. Milestones

| # | Milestone | Status | Exit criteria |
|---|---|---|---|
| M1 | Categorisation engine (`src/spend_engine`, FastAPI, pytest) | **Done** | ≥85% category accuracy on a blind labeled split; unit tests green |
| M1.5 | Data-source decision (see §3) | **Next** | Written decision on SMS vs Account Aggregator vs share-sheet, with Play policy confirmation |
| M2 | Spring Boot API + Postgres | Not started | Engine behind a stable contract; per-user data isolated; migrations |
| M3 | Ingestion pipeline (Kafka) | Not started | At-least-once ingest, idempotent on bank ref no. (already modelled in M1) |
| M4 | React Native Android app (`app/`) | **In progress** | v0.1 done: onboarding, Today, re-tag, Activity, add-from-SMS, Privacy; sample + live modes. Next: share intent, on-device parsing, auth |
| M5 | Account Aggregator integration (unblocks iOS) | Not started | Consent flow with a licensed AA; FIP data mapped to the M1 transaction model |

M4 started once M1 met the accuracy target. The app reads data only
through sources that need no restricted permission: pasted alerts sent to
the engine, or built-in sample data. M1.5 decides what replaces that.

## 2. M1: what was built

```
SMS ──▶ SmsParser ──▶ ParsedTransaction ──▶ Categorizer ──▶ CategoryResult
        (rules YAML)   amount, direction,    override ▶ credit⇒Income ▶ VPA
                       merchant, VPA, a/c,   ▶ alias ▶ fuzzy ▶ keyword ▶ Other
                       date, ref, mode
                                    │                            │
                                    ▼                            ▼
                                  Store (SQLite) ◀── corrections (per-user overrides)
                                    │
                                    ▼
                               daily_summary
```

* **Parser.** No bank format is hard-coded. `data/sms_rules.v1.yaml` holds
  ignore rules (OTP, collect requests, mandate notices, failures), footer
  cut-offs, bank templates and generic field extractors. Every parsed
  transaction and every logged failure carries the rules `version`.
  Failures are logged to `spend_engine.parser` and stored in
  `parse_failures` for triage.
* **Categoriser.** Layers run highest confidence first. Each result returns
  `category`, `confidence` and `layer`:

  | Layer | Confidence | Example |
  |---|---|---|
  | user_override | 1.00 | user re-tagged "Iron Paradise" as Health |
  | direction | 0.90 | any credit ⇒ Income |
  | vpa | 0.90–0.98 | `swiggy@icici`, `bigbasket.payu@hdfcbank` |
  | alias | 0.92 | "NACH ACH-DR NETFLIX ENTERTAINMENT" |
  | fuzzy | ≤0.80 × similarity | "SWIGY", "FLIPKRT" (Levenshtein, aliases ≥6 chars) |
  | keyword | 0.60 | "SRI SAI MEDICALS" ⇒ Health |
  | fallback | 0.20 | Other |

* **Seed dictionary.** 123 Indian merchants and billers in
  `data/merchants.yaml`, plus keyword rules in `data/keywords.yaml`.
* **Corrections.** `POST /corrections` stores an override keyed by VPA
  (exact payee) and normalised merchant name. It beats every other layer for
  that user, and by default also re-tags their earlier transactions to the
  same payee.
* **Summary.** `GET /summary?date=&user_id=` returns total income, total
  spend, net, spend by category with percentages, and the top category.
* **Duplicates.** The same alert received twice (same ref no., amount and
  direction) is stored once.

### Accuracy (see `reports/accuracy.md`)

All 183 labeled messages are fictional and hand-written, imitating alert
formats from 15 banks.

| Split | Role | Category accuracy |
|---|---|---|
| dev (86 msgs) | rules tuned against it | 100% |
| holdout-1 (51) | blind at rules 2026.10.1, then used for tuning | **76.6% blind** → 100% after |
| holdout-2 (46) | blind at rules 2026.10.2, not tuned | **90.7%** (95% CI lower bound 78.4%) |

The honest figure is about 91% on unseen formats. The first blind score of
77% shows how quickly a new bank format drags accuracy down. Before relying
on this, re-measure on **consented, anonymised real alerts**; hand-written
samples are a stand-in.

### Known gaps (holdout-2 misses, intentionally not tuned)

1. Axis-style multi-line card alerts with the merchant on its own line and
   no "at" (`Spent INR 870.00 / Card no. XX7777 / … / KFC KORAMANGALA`). The
   merchant is not extracted. Fix: an Axis card template.
2. A partial alias beats a fuzzy fix: "SWIGGY INSTAMRT" hits the `swiggy`
   alias (Food) before fuzzy can match `instamart` (Groceries). Fix: run
   fuzzy on the leftover tokens and prefer the longer match.
3. "…Payment of Rs X received towards your Credit Card" is read as a debit
   because "payment of" comes first. It is also not income. Fix: a
   card-bill-payment rule that marks it as a transfer.
4. "Traders" ⇒ Shopping is too eager for generic shop names. Consider
   dropping generic retail words from the keyword list.

Also seen: HDFC "Sent Rs… From… To…" alerts only say "UPI" in the footer, so
`mode` comes out UNKNOWN when the footer is cut. Templates should set the
mode.

Product questions that came out of labelling: transfers between your own
accounts, investments (Zerodha), personal care (salons) and refunds are
"Other" or "Income" today. A **Transfers** and an **Investments** category
would make the daily summary more truthful. That is a design decision.

## 3. Data source: Google Play SMS policy (blocking for M4)

Checked 22 Oct 2026. Google Play's *SMS and Call Log permissions* policy
only lets an app request `READ_SMS` / `RECEIVE_SMS` if it is the user's
**default SMS handler**, or if its core function is on the policy's list of
exceptions and declared in Play Console via the Permissions Declaration
Form. The current text I could retrieve lists no exception for
personal-finance or budgeting apps. Developers report rejections for exactly
this use case, with Google pointing to manual entry as the alternative.
Sources:
[policy](https://support.google.com/googleplay/android-developer/answer/9047303),
[sensitive permissions](https://support.google.com/googleplay/android-developer/answer/9888170),
[developer report](https://dev.to/zeta_byte/ive-been-working-on-a-personal-finance-app-called-finvantage-and-i-recently-hit-a-roadblock-4mjh).

**Recommendation.** Treat `READ_SMS` as *not available* until a Play
declaration is actually approved. Build the app on sources that need no
restricted permission:

1. **Account Aggregator (RBI framework)** as the primary source on Android
   *and* iOS. This pulls M5 forward. The AA's FIP data maps onto the same
   `ParsedTransaction` model, so the categoriser is unchanged.
2. **Share-to-SPEND** (Android share sheet) and paste: the user shares a
   bank alert, and the M1 parser handles it unchanged.
3. **Manual entry**, always available.
4. **SMS reading** only behind a feature flag, if a declaration is approved.

The onboarding screen in the design reflects this order. Before
committing, confirm the current exception table in Play Console. The
retrieved policy text may be incomplete.

## 4. UX design

Canvas: *SPEND app design* (Claude artifact). Source in `design/project/`.

* **Today** (interactive): spent today, income, top category, a
  stacked bar plus ranked list of spend by category, and the day's
  transactions. Low-confidence payments surface as a **Needs review** card.
  Re-tagging opens a bottom sheet with eight category tiles and a
  "remember for every payment to X" switch, which maps to the per-user
  override.
* **Onboarding: data access**: Account Aggregator / SMS / share-or-manual,
  privacy promise (no passwords, PINs or OTPs, never moves money).
* **Activity**: searchable, filterable list grouped by day with day totals.
* **Design tokens**: category colours and icons, neutrals, type scale,
  confidence chips, spacing and buttons.

Principles: amounts in Indian digit grouping (₹1,24,500) with tabular
figures; income in blue with a "+", spend in ink, never red/green alone;
category colour always paired with its label; every auto-tag shows its
confidence (Auto / Likely / Needs review / You tagged); 44 px touch targets;
text contrast ≥4.5:1.

## 5. Next steps

1. M1.5 data-source decision (§3). It decides whether M4 starts with AA or
   with share-sheet ingest.
2. Collect consented, anonymised alerts from 5–10 testers (with PII
   scrubbed on device) to replace the hand-written labeled set. Re-run
   `python -m spend_engine.evaluate`.
3. Close the four known gaps as rules `2026.10.3`, then write a fresh blind
   split before claiming a new number.
4. Decide on Transfers / Investments categories.
5. Start M2 (Spring Boot + Postgres) with the M1 schema in `store.py` as the
   starting point.
