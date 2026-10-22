import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { ApiRepository } from './api';
import { isoDay } from './format';
import type { SpendRepository } from './repository';
import { SAMPLE_TODAY, SampleRepository } from './sample';
import type { Transaction } from './types';

export type Mode = 'sample' | 'live';

export interface Settings {
  onboarded: boolean;
  mode: Mode;
  apiUrl: string;
  userId: string;
}

const STORAGE_KEY = 'spend.settings.v1';

/** Where a dev engine is reachable: the Android emulator sees the host
 * machine as 10.0.2.2; web and iOS simulators use localhost. Override with
 * EXPO_PUBLIC_SPEND_API_URL. */
export function defaultApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SPEND_API_URL;
  if (fromEnv) return fromEnv;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

function newUserId(): string {
  return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULTS = (): Settings => ({ onboarded: false, mode: 'sample', apiUrl: defaultApiUrl(), userId: newUserId() });

interface AppState {
  ready: boolean;
  settings: Settings;
  update(patch: Partial<Settings>): Promise<void>;
  reset(): Promise<void>;
  repo: SpendRepository;
  /** The day screens treat as today: the real date live, a fixed one for samples. */
  today: string;
  /** Increments whenever data changes, so screens refetch. */
  revision: number;
  bump(): void;
  /** Last-seen transactions by id, so the re-tag sheet can open instantly. */
  remember(txns: Transaction[]): void;
  lookup(id: number): Transaction | undefined;
  toast: string | null;
  notify(message: string): void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [revision, setRevision] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const cache = useRef(new Map<number, Transaction>());
  // Latest settings for async writers; updated wherever settings are set.
  const settingsRef = useRef(settings);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const loaded = { ...DEFAULTS(), ...(JSON.parse(raw) as Partial<Settings>) };
          settingsRef.current = loaded;
          setSettings(loaded);
        }
      })
      .catch(() => undefined) // unreadable storage: start fresh
      .finally(() => setReady(true));
    return () => clearTimeout(toastTimer.current);
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    cache.current.clear();
    setRevision((r) => r + 1);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const reset = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
    cache.current.clear();
    const fresh = DEFAULTS();
    settingsRef.current = fresh;
    setSettings(fresh);
    setRevision((r) => r + 1);
  }, []);

  // One sample repository per session, so corrections survive navigation.
  const sample = useMemo(() => new SampleRepository(), []);
  const repo = useMemo<SpendRepository>(
    () => (settings.mode === 'live' ? new ApiRepository(settings.apiUrl, settings.userId) : sample),
    [settings.mode, settings.apiUrl, settings.userId, sample],
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      settings,
      update,
      reset,
      repo,
      today: settings.mode === 'live' ? isoDay() : SAMPLE_TODAY,
      revision,
      bump: () => setRevision((r) => r + 1),
      remember: (txns) => txns.forEach((t) => cache.current.set(t.id, t)),
      lookup: (id) => cache.current.get(id),
      toast,
      notify: (message) => {
        setToast(message);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3200);
      },
    }),
    [ready, settings, update, reset, repo, revision, toast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
