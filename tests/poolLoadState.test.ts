import { describe, expect, test } from 'bun:test';
import {
  INITIAL_POOL_LOAD,
  finishPoolLoad,
  poolPageView,
  startPoolLoad,
} from '../src/features/pool/hooks/poolLoadState';
import type { PoolOverview } from '../src/types/pool';

const overview = (accounts = 1): PoolOverview => ({
  schemaVersion: 1,
  observedAt: '2026-11-04T10:00:00Z',
  accounts: Array.from({ length: accounts }, (_, index) => ({
    id: `a${index}`,
    provider: 'claude',
    label: `a${index}@x`,
    kind: 'subscription',
    state: 'ready',
    reason: 'Ready',
    healthReason: 'Ready',
    eligible: true,
    priority: 0,
    resetAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    balance: null,
    fileName: null,
    authIndex: `a${index}`,
    managedIn: 'pool',
  })),
  policy: { strategy: 'existing', allowPaidFallback: true },
  stats: {
    available: false,
    reason: '',
    from: null,
    to: null,
    persistence: null,
    requests: 0,
    successes: 0,
    failures: 0,
    failovers: 0,
    inputTokens: null,
    outputTokens: null,
    averageLatencyMs: null,
  },
  persistence: 'kv',
  homeMode: false,
  source: 'pool',
});

describe('pool load state', () => {
  test('a first load that fails is an error, not an empty pool, an older backend or loading', () => {
    const loading = startPoolLoad(INITIAL_POOL_LOAD);
    expect(poolPageView(loading)).toMatchObject({ loading: true, failed: false });
    const failed = finishPoolLoad(loading, { kind: 'error', message: 'HTTP 500' }, 1000);
    expect(failed.status).toBe('error');
    expect(failed.overview).toBeNull();
    expect(failed.unsupported).toBe(false);
    expect(failed.error).toBe('HTTP 500');
    expect(poolPageView(failed)).toEqual({
      loading: false,
      failed: true,
      stale: false,
      olderBackend: false,
      empty: false,
    });
  });

  test('a refresh that fails keeps the last good data and marks it stale with its time', () => {
    const ready = finishPoolLoad(
      startPoolLoad(INITIAL_POOL_LOAD),
      { kind: 'pool', overview: overview(2) },
      5000
    );
    expect(ready.checkedAtMs).toBe(5000);
    const refreshing = startPoolLoad(ready);
    expect(refreshing.status).toBe('ready');
    expect(refreshing.overview).toBe(ready.overview);
    const stale = finishPoolLoad(refreshing, { kind: 'error', message: 'HTTP 502' }, 9000);
    expect(stale.status).toBe('ready');
    expect(stale.overview).toBe(ready.overview);
    expect(stale.checkedAtMs).toBe(5000);
    expect(stale.error).toBe('HTTP 502');
    expect(poolPageView(stale)).toMatchObject({ stale: true, failed: false, loading: false, empty: false });
    // The next good load clears the stale flag.
    const recovered = finishPoolLoad(stale, { kind: 'pool', overview: overview(2) }, 12000);
    expect(recovered.stale).toBe(false);
    expect(recovered.error).toBeNull();
    expect(recovered.checkedAtMs).toBe(12000);
  });

  test('only a credentials-derived load is an older backend; only reported data can be empty', () => {
    const older = finishPoolLoad(INITIAL_POOL_LOAD, { kind: 'credentials', overview: overview(0) }, 1);
    expect(poolPageView(older)).toMatchObject({ olderBackend: true, empty: true, failed: false });
    const pool = finishPoolLoad(INITIAL_POOL_LOAD, { kind: 'pool', overview: overview(0) }, 1);
    expect(poolPageView(pool)).toMatchObject({ olderBackend: false, empty: true });
  });
});
