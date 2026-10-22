import { displayName, needsReview } from './format';
import type { Transaction } from './types';

export type Filter = 'all' | 'spend' | 'income' | 'review';

export function filterTransactions(txns: Transaction[], filter: Filter, query: string): Transaction[] {
  const q = query.trim().toLowerCase();
  return txns.filter((t) => {
    if (filter === 'spend' && t.direction !== 'debit') return false;
    if (filter === 'income' && t.direction !== 'credit') return false;
    if (filter === 'review' && !(t.direction === 'debit' && needsReview(t))) return false;
    if (!q) return true;
    const haystack = [displayName(t), t.merchant, t.vpa, t.category, String(t.amount)].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
