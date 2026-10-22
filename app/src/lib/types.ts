// Mirrors the spend_engine API (src/spend_engine/api.py).

export const CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Income',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Categories a user can pick for a debit (Income comes from the direction). */
export const PICKABLE: Category[] = CATEGORIES.filter((c) => c !== 'Income');

export type Direction = 'debit' | 'credit';
export type Layer = 'user_override' | 'direction' | 'vpa' | 'alias' | 'fuzzy' | 'keyword' | 'fallback';

export interface Transaction {
  id: number;
  txn_date: string | null;
  amount: number;
  amount_paise: number;
  direction: Direction;
  merchant: string | null;
  vpa: string | null;
  account_last4: string | null;
  ref_no: string | null;
  mode: string;
  category: Category;
  confidence: number;
  layer: Layer;
  matched: string | null;
  created_at: string;
}

export interface CategorySpend {
  category: Category;
  amount: number;
  percentage: number;
  count: number;
}

export interface DailySummary {
  date: string;
  user_id: string;
  total_income: number;
  total_spend: number;
  net: number;
  transaction_count: number;
  by_category: CategorySpend[];
  top_category: Category | null;
}

export interface CategoryResult {
  category: Category;
  confidence: number;
  layer: Layer;
  matched: string | null;
}

export interface CategorizeResponse {
  transaction_id: number | null;
  duplicate: boolean;
  transaction: {
    amount: number;
    direction: Direction;
    merchant: string | null;
    vpa: string | null;
    txn_date: string | null;
    mode: string;
  };
  result: CategoryResult;
}

export interface CorrectionResponse {
  override_keys: string[];
  updated_transactions: number;
}
