import type { Category, CategorizeResponse, CorrectionResponse, DailySummary, Transaction } from './types';

/** Where the app's data comes from. `live` talks to the spend_engine API;
 * `sample` serves fictional demo data from memory so the app works offline. */
export interface SpendRepository {
  readonly kind: 'live' | 'sample';
  transactions(from: string, to: string): Promise<Transaction[]>;
  summary(date: string): Promise<DailySummary>;
  categorize(sms: string): Promise<CategorizeResponse>;
  correct(transactionId: number, category: Category, applyToPast: boolean): Promise<CorrectionResponse>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    /** Machine-readable cause: an engine parse-failure reason
     * ("not_transactional", "no_amount"...), "network", "needs_server", or "http_<status>". */
    readonly reason: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

const PARSE_MESSAGES: Record<string, string> = {
  not_transactional: 'That looks like an OTP, offer or reminder, not a completed payment.',
  no_amount: 'We couldn’t find an amount in that message.',
  no_direction: 'We couldn’t tell whether money went out or came in.',
  empty_message: 'Paste a bank or UPI message first.',
};

export function messageFor(err: unknown): string {
  if (err instanceof RepositoryError) return PARSE_MESSAGES[err.reason] ?? err.message;
  return 'Something went wrong. Try again.';
}
