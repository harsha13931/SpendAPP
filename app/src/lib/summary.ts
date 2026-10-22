import type { Category, CategorySpend, DailySummary, Transaction } from './types';

/** Same rules as spend_engine.summary.daily_summary: income is every credit,
 * spend is every debit, broken down by category, largest first. */
export function summarize(userId: string, date: string, txns: Transaction[]): DailySummary {
  let income = 0;
  let spend = 0;
  const per = new Map<Category, { paise: number; count: number }>();
  for (const t of txns) {
    if (t.direction === 'credit') {
      income += t.amount_paise;
      continue;
    }
    spend += t.amount_paise;
    const b = per.get(t.category) ?? { paise: 0, count: 0 };
    b.paise += t.amount_paise;
    b.count += 1;
    per.set(t.category, b);
  }
  const by_category: CategorySpend[] = [...per.entries()]
    .sort((a, b) => b[1].paise - a[1].paise || a[0].localeCompare(b[0]))
    .map(([category, b]) => ({
      category,
      amount: b.paise / 100,
      percentage: spend ? Math.round((1000 * b.paise) / spend) / 10 : 0,
      count: b.count,
    }));
  return {
    date,
    user_id: userId,
    total_income: income / 100,
    total_spend: spend / 100,
    net: (income - spend) / 100,
    transaction_count: txns.length,
    by_category,
    top_category: by_category[0]?.category ?? null,
  };
}
