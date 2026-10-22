import type { Transaction } from './types';

/** Indian digit grouping: 124500 -> "1,24,500". */
function groupIndian(whole: string): string {
  if (whole.length <= 3) return whole;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** "₹1,24,500" — paise shown only when present ("₹1,186.50"). */
export function rupees(amount: number, opts: { sign?: boolean } = {}): string {
  const negative = amount < 0;
  const paise = Math.round(Math.abs(amount) * 100);
  const whole = groupIndian(String(Math.floor(paise / 100)));
  const frac = paise % 100;
  const body = `₹${whole}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`;
  if (negative) return `−${body}`;
  return opts.sign ? `+${body}` : body;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local calendar day as YYYY-MM-DD. */
export function isoDay(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Today, 21 Oct", "Yesterday, 20 Oct", "Mon, 19 Oct". */
export function dayLabel(iso: string, today: string): string {
  const d = parseIso(iso);
  const short = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  if (iso === today) return `Today, ${short}`;
  if (iso === addDays(today, -1)) return `Yesterday, ${short}`;
  return `${DAYS[d.getUTCDay()]}, ${short}`;
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s; // already mixed case: trust it
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

/** The name to show for a transaction. Dictionary hits use the canonical
 * merchant name; everything else falls back to what the bank sent. */
export function displayName(t: Pick<Transaction, 'layer' | 'matched' | 'merchant' | 'vpa'>): string {
  if ((t.layer === 'vpa' || t.layer === 'alias' || t.layer === 'fuzzy') && t.matched) return t.matched;
  if (t.merchant) return titleCase(t.merchant);
  if (t.vpa) return t.vpa;
  return 'Bank transfer';
}

export const MODE_LABEL: Record<string, string> = {
  UPI: 'UPI',
  CARD: 'Card',
  ATM: 'ATM',
  NACH: 'Autopay',
  NEFT: 'NEFT',
  IMPS: 'IMPS',
  RTGS: 'RTGS',
  NETBANKING: 'Net banking',
  UNKNOWN: 'Bank',
};

export type ChipTone = 'quiet' | 'neutral' | 'alert';
export interface Chip {
  label: 'Auto' | 'Likely' | 'Needs review' | 'You tagged';
  tone: ChipTone;
}

/** How sure the engine is, in words. Thresholds match the design system. */
export function confidenceChip(t: Pick<Transaction, 'layer' | 'confidence'>): Chip {
  if (t.layer === 'user_override') return { label: 'You tagged', tone: 'neutral' };
  if (t.confidence >= 0.85) return { label: 'Auto', tone: 'quiet' };
  if (t.confidence >= 0.5) return { label: 'Likely', tone: 'neutral' };
  return { label: 'Needs review', tone: 'alert' };
}

export function needsReview(t: Pick<Transaction, 'layer' | 'confidence'>): boolean {
  return confidenceChip(t).tone === 'alert';
}
