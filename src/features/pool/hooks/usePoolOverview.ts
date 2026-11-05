import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFilesApi, poolApi } from '@/services/api';
import { useAuthStore } from '@/stores';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import type { TrafficWindow } from '@/features/dashboard/types';
import type { AuthFileItem } from '@/types/authFile';
import type { PoolAccount, PoolOverview } from '@/types/pool';
import { getErrorMessage } from '@/utils/helpers';
import { attachCredentialHandles } from '../credentialHandles';
import { accountsFromCredentials, isPoolEndpointMissing, normalizePoolOverview } from '../logic';
import {
  INITIAL_POOL_LOAD,
  finishPoolLoad,
  poolPageView,
  startPoolLoad,
  type PoolLoadOutcome,
  type PoolLoadState,
  type PoolPageView,
} from './poolLoadState';

export type { PoolOverviewStatus } from './poolLoadState';

export interface PoolOverviewState extends PoolLoadState {
  /** Derived presentation flags shared by every pool page. */
  view: PoolPageView;
  /** Recent request window from credential counters; the only traffic older backends report. */
  recentTraffic: TrafficWindow;
  refresh: () => Promise<void>;
  /** Pause, resume, refresh or clear-limit a credential-backed account, then reload. */
  act: (action: PoolAccountAction, account: PoolAccount) => Promise<void>;
}

export type PoolAccountAction = 'pause' | 'resume' | 'check' | 'clear_limit';

const credentialsOverview = (files: AuthFileItem[], observedAt: string | null): PoolOverview => ({
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
  homeMode: false,
  source: 'credentials',
});

/**
 * One load: the pool endpoint, with credential handles attached; on a backend without it,
 * the same model from the credentials list. Any other failure is reported as such, never as
 * an empty pool or an older backend.
 */
async function loadOutcome(): Promise<PoolLoadOutcome> {
  let files: AuthFileItem[] = [];
  let observedAt: string | null = null;
  let filesError: unknown = null;
  try {
    const response = await authFilesApi.list();
    files = response.files;
    observedAt = response.observedAt ?? null;
  } catch (error) {
    // The pool endpoint can still answer; credentials only add action handles here.
    filesError = error;
  }

  try {
    const payload = await poolApi.getOverview();
    const normalized = normalizePoolOverview(payload);
    return {
      kind: 'pool',
      overview: { ...normalized, accounts: attachCredentialHandles(normalized.accounts, files) },
    };
  } catch (poolError) {
    if (!isPoolEndpointMissing(poolError)) {
      return { kind: 'error', message: getErrorMessage(poolError, 'Request failed') };
    }
  }

  // Older backend: the credentials list is the only source, so its failure is the failure.
  if (filesError) {
    return { kind: 'error', message: getErrorMessage(filesError, 'Request failed') };
  }
  return { kind: 'credentials', overview: credentialsOverview(files, observedAt) };
}

export function usePoolOverview(): PoolOverviewState {
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const dashboard = useDashboardOverview();

  const [state, setState] = useState<PoolLoadState>(INITIAL_POOL_LOAD);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!connected) return;
    const requestId = ++requestRef.current;
    setState(startPoolLoad);
    const outcome = await loadOutcome();
    // A response from before a disconnect or a newer load must not land on the current state.
    if (requestId !== requestRef.current) return;
    setState((previous) => finishPoolLoad(previous, outcome, Date.now()));
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      requestRef.current += 1;
      setState(INITIAL_POOL_LOAD);
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
      } else if (action === 'pause')
        await authFilesApi.setStatus(account.fileName, true, authIndex);
      else if (action === 'resume')
        await authFilesApi.setStatus(account.fileName, false, authIndex);
      else if (action === 'check')
        await authFilesApi.requestManualRefresh(account.fileName, authIndex);
      await load();
    },
    [load]
  );

  const view = useMemo(() => poolPageView(state), [state]);

  return useMemo(
    () => ({ ...state, view, recentTraffic: dashboard.traffic, refresh, act }),
    [state, view, dashboard.traffic, refresh, act]
  );
}
