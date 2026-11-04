import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFilesApi, poolApi } from '@/services/api';
import { useAuthStore } from '@/stores';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import type { TrafficWindow } from '@/features/dashboard/types';
import type { AuthFileItem } from '@/types/authFile';
import type { PoolAccount, PoolOverview } from '@/types/pool';
import { getErrorMessage } from '@/utils/helpers';
import { accountsFromCredentials, isPoolEndpointMissing, normalizePoolOverview } from '../logic';

export type PoolOverviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PoolOverviewState {
  status: PoolOverviewStatus;
  overview: PoolOverview | null;
  /** True when this backend has no `/pool/*` endpoints; `overview` is then credential-derived. */
  unsupported: boolean;
  error: string | null;
  /** Recent request window from credential counters; the only traffic older backends report. */
  recentTraffic: TrafficWindow;
  refresh: () => Promise<void>;
  /** Pause, resume, refresh or clear-limit a credential-backed account, then reload. */
  act: (action: PoolAccountAction, account: PoolAccount) => Promise<void>;
}

export type PoolAccountAction = 'pause' | 'resume' | 'check' | 'clear_limit';

/** Pool accounts gain a file handle when a credential matches by name, index or label. */
const attachCredentialHandles = (accounts: PoolAccount[], files: AuthFileItem[]): PoolAccount[] =>
  accounts.map((account) => {
    if (account.fileName) return account;
    const match = files.find((file) => {
      if (file.runtimeOnly === true || file.runtimeOnly === 'true') return false;
      const name = String(file.name ?? '');
      const index = file.authIndex === null || file.authIndex === undefined ? '' : String(file.authIndex);
      // The pool id is the credential's auth index; names and e-mails are fallbacks.
      return (
        (index && (index === account.id || index === account.authIndex)) ||
        (name && (name === account.id || name === account.fileName)) ||
        (account.label && file.email === account.label)
      );
    });
    if (!match) return account;
    const authIndex = match.authIndex === null || match.authIndex === undefined ? null : String(match.authIndex);
    return { ...account, fileName: String(match.name ?? '') || null, authIndex: authIndex ?? account.authIndex };
  });

export function usePoolOverview(): PoolOverviewState {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const dashboard = useDashboardOverview();

  const [status, setStatus] = useState<PoolOverviewStatus>('idle');
  const [overview, setOverview] = useState<PoolOverview | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!connected) return;
    const requestId = ++requestRef.current;
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    setError(null);

    let files: AuthFileItem[] = [];
    let observedAt: string | null = null;
    try {
      const response = await authFilesApi.list();
      files = response.files;
      observedAt = response.observedAt ?? null;
    } catch {
      // The pool endpoint can still answer; credentials only add action handles here.
    }

    try {
      const payload = await poolApi.getOverview();
      if (requestId !== requestRef.current) return;
      const normalized = normalizePoolOverview(payload);
      setOverview({ ...normalized, accounts: attachCredentialHandles(normalized.accounts, files) });
      setUnsupported(false);
      setStatus('ready');
      return;
    } catch (poolError) {
      if (requestId !== requestRef.current) return;
      if (!isPoolEndpointMissing(poolError)) {
        setError(getErrorMessage(poolError, 'Request failed'));
        setStatus('error');
        return;
      }
    }

    // Older backend: derive the same model from the credentials list.
    try {
      if (files.length === 0 && !observedAt) {
        const response = await authFilesApi.list();
        if (requestId !== requestRef.current) return;
        files = response.files;
        observedAt = response.observedAt ?? null;
      }
      setOverview({
        schemaVersion: 0,
        observedAt: observedAt ?? new Date().toISOString(),
        accounts: accountsFromCredentials(files, Date.now()),
        policy: null,
        stats: {
          available: false,
          reason: 'unsupported',
          from: null,
          to: null,
          requests: 0,
          successes: 0,
          failures: 0,
          failovers: 0,
          inputTokens: null,
          outputTokens: null,
          averageLatencyMs: null,
          persistence: null,
        },
        persistence: null,
        source: 'credentials',
      });
      setUnsupported(true);
      setStatus('ready');
    } catch (listError) {
      if (requestId !== requestRef.current) return;
      setError(getErrorMessage(listError, 'Request failed'));
      setStatus('error');
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      requestRef.current += 1;
      setOverview(null);
      setStatus('idle');
      return;
    }
    void load();
  }, [connected, load]);

  const refresh = useCallback(async () => {
    await Promise.allSettled([load(), dashboard.refresh()]);
  }, [load, dashboard]);

  const act = useCallback(
    async (action: PoolAccountAction, account: PoolAccount) => {
      const authIndex = account.authIndex ?? undefined;
      if (action === 'clear_limit') {
        // The pool reset clears credit blocks and cooldowns; older backends only know cooldowns.
        if (account.managedIn === 'pool') await poolApi.resetAccount(account.id);
        else if (account.authIndex) await authFilesApi.resetCooldown(account.authIndex);
      } else if (!account.fileName) {
        return;
      } else if (action === 'pause') await authFilesApi.setStatus(account.fileName, true, authIndex);
      else if (action === 'resume') await authFilesApi.setStatus(account.fileName, false, authIndex);
      else if (action === 'check') await authFilesApi.requestManualRefresh(account.fileName, authIndex);
      await load();
    },
    [load]
  );

  return useMemo(
    () => ({ status, overview, unsupported, error, recentTraffic: dashboard.traffic, refresh, act }),
    [status, overview, unsupported, error, dashboard.traffic, refresh, act]
  );
}
