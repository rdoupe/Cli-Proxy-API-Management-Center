/**
 * Load state for the pool overview, as a pure reducer so its transitions can be tested without
 * React: a first load that fails is an error, not an empty pool or an older backend; a refresh
 * that fails keeps the last successful data and marks it stale.
 */

import type { PoolOverview } from '@/types/pool';

export type PoolOverviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PoolLoadState {
  status: PoolOverviewStatus;
  /** Last successfully loaded overview; kept when a later refresh fails. */
  overview: PoolOverview | null;
  /** True when this backend has no `/pool/*` endpoints; `overview` is then credential-derived. */
  unsupported: boolean;
  /** Message of the most recent failure, cleared by the next successful load. */
  error: string | null;
  /** True when `overview` is from an earlier load because the latest one failed. */
  stale: boolean;
  /** Wall-clock instant of the last successful load. */
  checkedAtMs: number | null;
}

export const INITIAL_POOL_LOAD: PoolLoadState = {
  status: 'idle',
  overview: null,
  unsupported: false,
  error: null,
  stale: false,
  checkedAtMs: null,
};

export type PoolLoadOutcome =
  | { kind: 'pool'; overview: PoolOverview }
  | { kind: 'credentials'; overview: PoolOverview }
  | { kind: 'error'; message: string };

/** A load begins: shown data stays on screen; only an empty page shows a loading state. */
export function startPoolLoad(previous: PoolLoadState): PoolLoadState {
  return { ...previous, status: previous.overview ? 'ready' : 'loading' };
}

export function finishPoolLoad(
  previous: PoolLoadState,
  outcome: PoolLoadOutcome,
  nowMs: number
): PoolLoadState {
  if (outcome.kind === 'error') {
    if (previous.overview) {
      return { ...previous, status: 'ready', error: outcome.message, stale: true };
    }
    return { ...INITIAL_POOL_LOAD, status: 'error', error: outcome.message };
  }
  return {
    status: 'ready',
    overview: outcome.overview,
    unsupported: outcome.kind === 'credentials',
    error: null,
    stale: false,
    checkedAtMs: nowMs,
  };
}

/** What a page shows for a given load state; one place so Overview and Accounts agree. */
export interface PoolPageView {
  /** Nothing to show yet and a load is in flight. */
  loading: boolean;
  /** Nothing to show because every load so far failed. */
  failed: boolean;
  /** Data is shown but the latest refresh failed. */
  stale: boolean;
  /** Data is shown and it came from the credentials list of an older backend. */
  olderBackend: boolean;
  /** Data is shown and the backend reported no accounts at all. */
  empty: boolean;
}

export function poolPageView(state: PoolLoadState): PoolPageView {
  const hasData = state.overview !== null;
  return {
    loading: !hasData && (state.status === 'idle' || state.status === 'loading'),
    failed: !hasData && state.status === 'error',
    stale: hasData && state.stale,
    olderBackend: hasData && state.unsupported,
    empty: hasData && state.overview!.accounts.length === 0,
  };
}
