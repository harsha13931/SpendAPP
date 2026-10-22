import { RepositoryError, type SpendRepository } from './repository';
import type { Category, CategorizeResponse, CorrectionResponse, DailySummary, Transaction } from './types';

type Fetch = typeof fetch;

export class ApiRepository implements SpendRepository {
  readonly kind = 'live' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly userId: string,
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      });
    } catch {
      throw new RepositoryError(`Can’t reach the SPEND server at ${this.baseUrl}.`, 'network');
    }
    if (res.ok) return (await res.json()) as T;

    let detail: unknown;
    try {
      detail = (await res.json()).detail;
    } catch {
      detail = undefined;
    }
    if (detail && typeof detail === 'object' && 'reason' in detail) {
      throw new RepositoryError('The message could not be read.', String((detail as { reason: unknown }).reason));
    }
    throw new RepositoryError(
      typeof detail === 'string' ? detail : `Server error ${res.status}.`,
      `http_${res.status}`,
    );
  }

  private query(params: Record<string, string>): string {
    return new URLSearchParams({ user_id: this.userId, ...params }).toString();
  }

  transactions(from: string, to: string): Promise<Transaction[]> {
    return this.request(`/transactions?${this.query({ from, to })}`);
  }

  summary(date: string): Promise<DailySummary> {
    return this.request(`/summary?${this.query({ date })}`);
  }

  categorize(sms: string): Promise<CategorizeResponse> {
    return this.request('/categorize', {
      method: 'POST',
      body: JSON.stringify({ user_id: this.userId, sms, received_at: new Date().toISOString() }),
    });
  }

  correct(transactionId: number, category: Category, applyToPast: boolean): Promise<CorrectionResponse> {
    return this.request('/corrections', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        transaction_id: transactionId,
        category,
        apply_to_past: applyToPast,
      }),
    });
  }
}
