/**
 * Account pool view model.
 *
 * The pool is every subscription login and API key CPA can route a request to. These types
 * mirror the v8 `/pool/*` management endpoints; when a backend predates them, the same shapes
 * are derived from the credentials list (see `features/pool/logic.ts`), never invented.
 */

export type PoolAccountKind = 'subscription' | 'api_key';

export type PoolAccountState =
  | 'ready'
  | 'paused'
  | 'rate_limited'
  | 'out_of_credits'
  | 'login_expired'
  | 'unavailable'
  | 'unknown';

/**
 * What a row, pill or legend entry says. `off_by_policy` is not a health state: it is an
 * API-key account the routing policy forbids (`allowPaidFallback: false`), derived from the
 * structured policy and kind, never from the backend's reason text.
 */
export type PoolAccountDisplayState = PoolAccountState | 'off_by_policy';

export const POOL_ACCOUNT_STATES: readonly PoolAccountState[] = [
  'ready',
  'rate_limited',
  'out_of_credits',
  'login_expired',
  'unavailable',
  'paused',
  'unknown',
];

export interface PoolBalance {
  amount: number | null;
  currency: string;
}

export interface PoolAccount {
  id: string;
  provider: string;
  label: string;
  kind: PoolAccountKind;
  state: PoolAccountState;
  /** Backend-supplied explanation of the state; empty when it gave none. */
  reason: string;
  /** The health sentence alone, without any policy note; empty on backends that omit it. */
  healthReason: string;
  eligible: boolean;
  priority: number | null;
  resetAt: string | null;
  lastSuccessAt: string | null;
  balance: PoolBalance | null;
  lastFailureAt: string | null;
  /** Credential file name when this account is backed by one, so actions can target it. */
  fileName: string | null;
  authIndex: string | null;
  /** Config API-key entries are managed in the providers workbench, not here. */
  managedIn: 'credentials' | 'providers' | 'pool';
}

export type PoolStrategy = 'existing' | 'subscriptions_first';

export interface PoolPolicy {
  strategy: PoolStrategy;
  allowPaidFallback: boolean;
}

export interface PoolStatTotals {
  requests: number;
  successes: number;
  failures: number;
  failovers: number;
  inputTokens: number | null;
  outputTokens: number | null;
  averageLatencyMs: number | null;
}

export type PoolPersistence = 'kv' | 'memory' | null;

export interface PoolStatsSummary extends PoolStatTotals {
  available: boolean;
  reason: string;
  from: string | null;
  to: string | null;
  /** "memory" means the numbers reset when the proxy restarts. */
  persistence: PoolPersistence;
}

export interface PoolOverview {
  schemaVersion: number;
  observedAt: string | null;
  accounts: PoolAccount[];
  policy: PoolPolicy | null;
  stats: PoolStatsSummary;
  persistence: PoolPersistence;
  /** True when the Home dispatcher, not this policy, chooses accounts. */
  homeMode: boolean;
  /** Where the data came from; the UI says so instead of pretending. */
  source: 'pool' | 'credentials';
}

export interface PoolSeriesPoint {
  at: string;
  requests: number;
  successes: number;
  failures: number;
  inputTokens: number | null;
  outputTokens: number | null;
  averageLatencyMs: number | null;
}

export interface PoolBreakdownRow {
  id: string;
  name: string;
  requests: number;
  successes: number;
  failures: number;
}

export type PoolStatsRange = '1h' | '24h' | '7d' | '30d';

export const POOL_STATS_RANGES: readonly PoolStatsRange[] = ['1h', '24h', '7d', '30d'];

export interface PoolStats {
  available: boolean;
  reason: string;
  range: PoolStatsRange;
  from: string | null;
  to: string | null;
  persistence: PoolPersistence;
  /** Earliest instant the server has data for. */
  observedSince: string | null;
  totals: PoolStatTotals;
  series: PoolSeriesPoint[];
  byProvider: PoolBreakdownRow[];
  byModel: PoolBreakdownRow[];
  byAccount: PoolBreakdownRow[];
}

export interface PoolExplainCandidate {
  id: string;
  label: string;
  eligible: boolean;
  reason: string;
}

export interface PoolExplain {
  model: string;
  policy: PoolPolicy | null;
  selectedAccountId: string | null;
  /** Eligible accounts sharing the top of the order; the strategy rotates between them. */
  tiedAccountIds: string[];
  candidates: PoolExplainCandidate[];
  reason: string;
  /** Backend caveat about what the explanation cannot see (per-request filters, rotation). */
  note: string;
}

/** Why a `/pool/*` call produced no data. */
export type PoolUnavailableReason = 'unsupported' | 'error';
