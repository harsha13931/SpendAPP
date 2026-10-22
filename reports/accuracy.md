# SPEND categorization accuracy report

Rules version `2026.10.2`. Target: 85% category accuracy.

All messages are fictional and hand-written. Only a split that was scored before any rule change counts as a blind estimate; each dataset file's header records whether rules were tuned against it. The 95% lower bound is a Wilson interval: with ~45 messages per split, read accuracy as a range, not a point.

| Split | Messages | Category accuracy | 95% lower bound | Non-txn rejected | Overall | Target met |
|---|---|---|---|---|---|---|
| labeled_dev | 86 | 80/80 = 100.0% | 95.4% | 6/6 | 100.0% | yes |
| labeled_holdout1 | 51 | 47/47 = 100.0% | 92.4% | 4/4 | 100.0% | yes |
| labeled_holdout2 | 46 | 39/43 = 90.7% | 78.4% | 3/3 | 91.3% | yes |

## labeled_dev

### Parse field accuracy

| Field | Correct |
|---|---|
| amount | 80/80 (100%) |
| direction | 80/80 (100%) |
| account | 10/10 (100%) |
| vpa | 6/6 (100%) |
| date | 17/17 (100%) |
| ref | 13/13 (100%) |
| mode | 24/24 (100%) |

### Matching layer

| Layer | Transactions |
|---|---|
| alias | 43 |
| keyword | 10 |
| direction | 9 |
| fallback | 8 |
| vpa | 8 |
| fuzzy | 2 |

### Misses

- none

## labeled_holdout1

### Parse field accuracy

| Field | Correct |
|---|---|
| amount | 47/47 (100%) |
| direction | 47/47 (100%) |
| account | 7/7 (100%) |
| vpa | 3/3 (100%) |
| date | 2/2 (100%) |
| ref | 4/4 (100%) |
| mode | 8/8 (100%) |

### Matching layer

| Layer | Transactions |
|---|---|
| alias | 24 |
| direction | 6 |
| vpa | 6 |
| keyword | 6 |
| fallback | 5 |

### Misses

- none

## labeled_holdout2

### Parse field accuracy

| Field | Correct |
|---|---|
| amount | 43/43 (100%) |
| direction | 42/43 (98%) |
| account | 1/1 (100%) |
| date | 1/1 (100%) |
| mode | 5/5 (100%) |

### Matching layer

| Layer | Transactions |
|---|---|
| alias | 17 |
| keyword | 8 |
| vpa | 7 |
| fallback | 6 |
| direction | 4 |
| fuzzy | 1 |

### Misses

- g005: direction = 'debit', expected 'credit'
- g008: category Shopping via keyword (merchant='SRI LAKSHMI TRADERS', vpa=None), expected Other
- g014: category Other via fallback (merchant=None, vpa=None), expected Food
- g015: category Other via fallback (merchant=None, vpa=None), expected Transport
- g038: category Food via alias (merchant='SWIGGY INSTAMRT', vpa=None), expected Groceries
