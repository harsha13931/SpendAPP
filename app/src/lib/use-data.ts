import { useEffect, useState } from 'react';

import { useAppState } from './app-state';
import { messageFor } from './repository';
import type { DailySummary, Transaction } from './types';

interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload(): void;
}

/** Loads data for `key`, refetching when the key or the app's data
 * revision changes (settings changes and corrections both bump it).
 * "loading" is derived from which key the stored data answers. */
function useLoad<T>(key: string, load: () => Promise<T>): Loaded<T> {
  const { revision, bump } = useAppState();
  const request = `${revision}|${key}`;
  const [state, setState] = useState<{ request: string | null; data: T | null; error: string | null }>({
    request: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ request, data, error: null }),
      (err) => !cancelled && setState({ request, data: null, error: messageFor(err) }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is rebuilt every render; `request` captures everything it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const loading = state.request !== request;
  // While a refetch runs, keep showing the previous data (pull-to-refresh).
  return { data: state.data, loading, error: loading ? null : state.error, reload: bump };
}

export function useDay(date: string): Loaded<{ summary: DailySummary; transactions: Transaction[] }> {
  const { repo, remember } = useAppState();
  return useLoad(`day:${date}`, async () => {
    const [summary, transactions] = await Promise.all([repo.summary(date), repo.transactions(date, date)]);
    remember(transactions);
    return { summary, transactions };
  });
}

export function useRange(from: string, to: string): Loaded<Transaction[]> {
  const { repo, remember } = useAppState();
  return useLoad(`range:${from}:${to}`, async () => {
    const txns = await repo.transactions(from, to);
    remember(txns);
    return txns;
  });
}
