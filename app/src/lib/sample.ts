import { RepositoryError, type SpendRepository } from './repository';
import { summarize } from './summary';
import type { Category, CategorizeResponse, CorrectionResponse, DailySummary, Layer, Transaction } from './types';

/** The day the sample data treats as "today". */
export const SAMPLE_TODAY = '2026-10-21';

type Row = [string, string | null, string | null, number, 'debit' | 'credit', string, Category, number, Layer, string | null];

// Output of spend_engine for fictional SMS (scripts/demo_day.py and the
// labeled dev set): date, merchant, vpa, amount, direction, mode, category,
// confidence, layer, matched merchant.
const ROWS: Row[] = [
  ['2026-10-21', 'IRON PARADISE', null, 1500, 'debit', 'UPI', 'Other', 0.2, 'fallback', null],
  ['2026-10-21', 'SRI SAI MEDICALS', null, 875, 'debit', 'CARD', 'Health', 0.6, 'keyword', 'medical'],
  ['2026-10-21', 'AMAZON PAY INDIA', null, 1499, 'debit', 'CARD', 'Shopping', 0.92, 'alias', 'Amazon'],
  ['2026-10-21', 'Zomato Ltd', null, 412, 'debit', 'UPI', 'Food', 0.92, 'alias', 'Zomato'],
  ['2026-10-21', null, 'priya.s@okhdfcbank', 1200, 'credit', 'UPI', 'Income', 0.9, 'direction', 'priya.s@okhdfcbank'],
  ['2026-10-21', 'BIGBASKET', null, 2340, 'debit', 'CARD', 'Groceries', 0.92, 'alias', 'BigBasket'],
  ['2026-10-21', 'GANESH TEA STALL', null, 60, 'debit', 'UPI', 'Food', 0.6, 'keyword', 'tea'],
  ['2026-10-21', 'NETFLIX COM', null, 199, 'debit', 'UPI', 'Entertainment', 0.92, 'alias', 'Netflix'],
  ['2026-10-21', null, 'rapido.ride@axisbank', 149, 'debit', 'UPI', 'Transport', 0.98, 'vpa', 'Rapido'],
  ['2026-10-21', 'ACME TECHNOLOGIES PVT LTD', null, 85000, 'credit', 'NEFT', 'Income', 0.9, 'direction', 'ACME TECHNOLOGIES PVT LTD'],
  ['2026-10-20', 'Blinkit', null, 1240, 'debit', 'UPI', 'Groceries', 0.92, 'alias', 'Blinkit'],
  ['2026-10-20', 'BIGBASKET', null, 1186.5, 'debit', 'UPI', 'Groceries', 0.92, 'alias', 'BigBasket'],
  ['2026-10-20', 'APOLLO PHARMACY', null, 1050, 'debit', 'UPI', 'Health', 0.92, 'alias', 'Apollo Pharmacy'],
  ['2026-10-20', 'Swiggy Instamart', null, 312, 'debit', 'UPI', 'Groceries', 0.92, 'alias', 'Swiggy Instamart'],
  ['2026-10-20', 'RAJESH KUMAR', null, 180, 'debit', 'UPI', 'Other', 0.2, 'fallback', null],
  ['2026-10-20', 'KARAN MEHTA', null, 2500, 'credit', 'UPI', 'Income', 0.9, 'direction', 'KARAN MEHTA'],
  ['2026-10-19', 'IRON PARADISE', null, 1500, 'debit', 'UPI', 'Other', 0.2, 'fallback', null],
  ['2026-10-19', 'ZEPTO MARKETPLACE', null, 455, 'debit', 'UPI', 'Groceries', 0.92, 'alias', 'Zepto'],
  ['2026-10-19', 'NAMMA YATRI', null, 640, 'debit', 'UPI', 'Transport', 0.92, 'alias', 'Namma Yatri'],
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !['pvt', 'private', 'ltd', 'limited', 'llp', 'inc', 'co', 'corp', 'www', 'com', 'in', 'the', 'm', 's'].includes(w))
    .join(' ');
}

/** Same keys as spend_engine.categorizer.override_keys. */
function payeeKeys(t: Pick<Transaction, 'merchant' | 'vpa'>): string[] {
  const keys: string[] = [];
  if (t.vpa) keys.push(`vpa:${t.vpa.toLowerCase()}`);
  if (t.merchant && normalize(t.merchant)) keys.push(`merchant:${normalize(t.merchant)}`);
  return keys;
}

export class SampleRepository implements SpendRepository {
  readonly kind = 'sample' as const;
  private txns: Transaction[];

  constructor(private readonly userId = 'sample') {
    this.txns = ROWS.map((r, i) => ({
      id: i + 1,
      txn_date: r[0],
      merchant: r[1],
      vpa: r[2],
      amount: r[3],
      amount_paise: Math.round(r[3] * 100),
      direction: r[4],
      mode: r[5],
      category: r[6],
      confidence: r[7],
      layer: r[8],
      matched: r[9],
      account_last4: null,
      ref_no: null,
      created_at: `${r[0]}T12:00:00Z`,
    }));
  }

  async transactions(from: string, to: string): Promise<Transaction[]> {
    return this.txns
      .filter((t) => t.txn_date !== null && t.txn_date >= from && t.txn_date <= to)
      .sort((a, b) => (b.txn_date ?? '').localeCompare(a.txn_date ?? '') || a.id - b.id)
      .map((t) => ({ ...t }));
  }

  async summary(date: string): Promise<DailySummary> {
    return summarize(this.userId, date, await this.transactions(date, date));
  }

  async categorize(): Promise<CategorizeResponse> {
    throw new RepositoryError(
      'Reading new messages needs the SPEND server. Connect one in Privacy, or keep exploring the sample data.',
      'needs_server',
    );
  }

  async correct(transactionId: number, category: Category, applyToPast: boolean): Promise<CorrectionResponse> {
    const target = this.txns.find((t) => t.id === transactionId);
    if (!target) throw new RepositoryError('Transaction not found.', 'http_404');
    const keys = payeeKeys(target);
    let updated = 0;
    for (const t of this.txns) {
      const samePayee = applyToPast && keys.length > 0 && payeeKeys(t).some((k) => keys.includes(k));
      if (t.id === transactionId || samePayee) {
        Object.assign(t, { category, confidence: 1, layer: 'user_override', matched: null });
        updated += 1;
      }
    }
    return { override_keys: keys, updated_transactions: updated };
  }
}
