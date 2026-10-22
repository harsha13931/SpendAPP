import { SampleRepository } from '@/lib/sample';
import { summarize } from '@/lib/summary';
import type { Transaction } from '@/lib/types';

function txn(p: Partial<Transaction>): Transaction {
  return {
    id: 1, txn_date: '2026-10-21', amount: 0, amount_paise: 0, direction: 'debit', merchant: null, vpa: null,
    account_last4: null, ref_no: null, mode: 'UPI', category: 'Other', confidence: 1, layer: 'alias', matched: null,
    created_at: '', ...p,
  };
}

it('matches the engine summary rules (tests/test_service.py::test_summary)', () => {
  const s = summarize('u1', '2026-10-21', [
    txn({ amount_paise: 25000, category: 'Food' }),
    txn({ amount_paise: 150000, category: 'Other' }),
    txn({ amount_paise: 5000000, direction: 'credit', category: 'Income' }),
  ]);
  expect([s.total_income, s.total_spend, s.net, s.transaction_count]).toEqual([50000, 1750, 48250, 3]);
  expect(s.by_category.map((c) => [c.category, c.amount, c.percentage])).toEqual([
    ['Other', 1500, 85.7],
    ['Food', 250, 14.3],
  ]);
  expect(s.top_category).toBe('Other');
});

it('handles an empty day', () => {
  const s = summarize('u1', '2026-01-01', []);
  expect([s.total_spend, s.by_category, s.top_category]).toEqual([0, [], null]);
});

it('sample day reproduces the demo numbers from the design', async () => {
  const s = await new SampleRepository().summary('2026-10-21');
  expect(s.total_spend).toBe(7034);
  expect(s.total_income).toBe(86200);
  expect(s.top_category).toBe('Groceries');
});
