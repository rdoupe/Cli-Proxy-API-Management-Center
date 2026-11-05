/**
 * Pool logic: normalizes the `/pool/*` contract, derives the same view model from the
 * credentials list on older backends, and computes the summaries the pages show.
 *
 * Nothing here estimates. A field the backend did not report stays null and the page says so.
 */

import type { AuthFileItem, AuthFileCooldown } from '@/types/authFile';
import type { ApiError } from '@/types/api';
import {
  POOL_ACCOUNT_STATES,
  POOL_STATS_RANGES,
  type PoolAccount,
  type PoolAccountDisplayState,
  type PoolAccountKind,
  type PoolAccountState,
  type PoolBalance,
  type PoolBreakdownRow,
  type PoolExplain,
  type PoolExplainCandidate,
  type PoolOverview,
  type PoolPersistence,
  type PoolPolicy,
  type PoolSeriesPoint,
  type PoolStatTotals,
  type PoolStats,
  type PoolStatsRange,
  type PoolStatsSummary,
} from '@/types/pool';
import { deriveAuthFileIdentity } from '@/features/authFiles/identity';
import { getAuthFileStatusMessage, hasAuthFileStatusWarning } from '@/features/authFiles/constants';
import { isRecord } from '@/utils/helpers';

/* ---------------------------------------------------------------------------------------------
 * Readers
 * ------------------------------------------------------------------------------------------- */

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readCount = (value: unknown): number => Math.max(0, readNullableNumber(value) ?? 0);

const readIsoDate = (value: unknown): string | null => {
  const text = readText(value);
  if (!text) return null;
  return Number.isNaN(Date.parse(text)) ? null : text;
};

const readState = (value: unknown): PoolAccountState => {
  const text = readText(value);
  return (POOL_ACCOUNT_STATES as readonly string[]).includes(text)
    ? (text as PoolAccountState)
    : 'unknown';
};

const readKind = (value: unknown): PoolAccountKind =>
  readText(value) === 'api_key' ? 'api_key' : 'subscription';

const readBalance = (value: unknown): PoolBalance | null => {
  if (!isRecord(value)) return null;
  const amount = readNullableNumber(value.amount);
  const currency = readText(value.currency) || 'USD';
  return { amount, currency };
};

const readPersistence = (value: unknown): PoolPersistence => {
  const text = readText(value);
  return text === 'kv' || text === 'memory' ? text : null;
};

const readPolicy = (value: unknown): PoolPolicy | null => {
  if (!isRecord(value)) return null;
  const strategy = readText(value.strategy);
  return {
    strategy: strategy === 'subscriptions_first' ? 'subscriptions_first' : 'existing',
    allowPaidFallback: value.allowPaidFallback === true,
  };
};

const readTotals = (value: unknown): PoolStatTotals => {
  const record = isRecord(value) ? value : {};
  return {
    requests: readCount(record.requests),
    successes: readCount(record.successes),
    failures: readCount(record.failures),
    failovers: readCount(record.failovers),
    inputTokens: readNullableNumber(record.inputTokens),
    outputTokens: readNullableNumber(record.outputTokens),
    averageLatencyMs: readNullableNumber(record.averageLatencyMs),
  };
};

const readAvailability = (value: unknown): { available: boolean; reason: string } => {
  const record = isRecord(value) ? value : {};
  return { available: record.available === true, reason: readText(record.reason) };
};

/* ---------------------------------------------------------------------------------------------
 * `/pool/*` normalizers
 * ------------------------------------------------------------------------------------------- */

const readPoolAccount = (value: unknown, index: number): PoolAccount | null => {
  if (!isRecord(value)) return null;
  const id = readText(value.id) || `account-${index}`;
  const state = readState(value.state);
  return {
    id,
    provider: readText(value.provider).toLowerCase() || 'unknown',
    label: readText(value.label) || id,
    kind: readKind(value.kind),
    state,
    reason: readText(value.reason),
    healthReason: readText(value.healthReason),
    eligible: value.eligible === true,
    priority: readNullableNumber(value.priority),
    resetAt: readIsoDate(value.resetAt),
    lastSuccessAt: readIsoDate(value.lastSuccessAt),
    lastFailureAt: readIsoDate(value.lastFailureAt),
    balance: readBalance(value.balance),
    fileName: readText(value.fileName) || null,
    // The pool id is the credential's auth index, which the credentials API also accepts.
    authIndex: readText(value.authIndex) || id,
    managedIn: 'pool',
  };
};

export function normalizePoolOverview(payload: unknown): PoolOverview {
  const record = isRecord(payload) ? payload : {};
  const accounts = Array.isArray(record.accounts)
    ? record.accounts
        .map(readPoolAccount)
        .filter((account): account is PoolAccount => account !== null)
    : [];
  const statsRecord = isRecord(record.stats) ? record.stats : {};
  const stats: PoolStatsSummary = {
    ...readAvailability(statsRecord),
    from: readIsoDate(statsRecord.from),
    to: readIsoDate(statsRecord.to),
    persistence: readPersistence(statsRecord.persistence),
    ...readTotals(statsRecord),
  };
  return {
    schemaVersion: readCount(record.schemaVersion) || 1,
    observedAt: readIsoDate(record.observedAt),
    accounts,
    policy: readPolicy(record.policy),
    stats,
    persistence: readPersistence(record.persistence),
    homeMode: record.homeMode === true,
    source: 'pool',
  };
}

const readSeriesPoint = (value: unknown): PoolSeriesPoint | null => {
  if (!isRecord(value)) return null;
  const at = readIsoDate(value.at);
  if (!at) return null;
  return {
    at,
    requests: readCount(value.requests),
    successes: readCount(value.successes),
    failures: readCount(value.failures),
    inputTokens: readNullableNumber(value.inputTokens),
    outputTokens: readNullableNumber(value.outputTokens),
    averageLatencyMs: readNullableNumber(value.averageLatencyMs),
  };
};

const readBreakdownRows = (value: unknown): PoolBreakdownRow[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const name = readText(entry.label) || readText(entry.name);
    const id = readText(entry.id) || name || `row-${index}`;
    return [
      {
        id,
        name: name || id,
        requests: readCount(entry.requests),
        successes: readCount(entry.successes),
        failures: readCount(entry.failures),
      },
    ];
  });
};

export const normalizePoolStatsRange = (value: unknown): PoolStatsRange =>
  (POOL_STATS_RANGES as readonly string[]).includes(readText(value))
    ? (readText(value) as PoolStatsRange)
    : '24h';

export function normalizePoolStats(payload: unknown, range: PoolStatsRange): PoolStats {
  const record = isRecord(payload) ? payload : {};
  const series = Array.isArray(record.series)
    ? record.series
        .map(readSeriesPoint)
        .filter((point): point is PoolSeriesPoint => point !== null)
        .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))
    : [];
  return {
    ...readAvailability(record),
    range,
    from: readIsoDate(record.from),
    to: readIsoDate(record.to),
    persistence: readPersistence(record.persistence),
    observedSince: readIsoDate(record.observedSince),
    totals: readTotals(record.totals),
    series,
    byProvider: readBreakdownRows(record.byProvider),
    byModel: readBreakdownRows(record.byModel),
    byAccount: readBreakdownRows(record.byAccount),
  };
}

export function normalizePoolExplain(payload: unknown): PoolExplain {
  const record = isRecord(payload) ? payload : {};
  const candidates: PoolExplainCandidate[] = Array.isArray(record.candidates)
    ? record.candidates.flatMap((entry, index) => {
        if (!isRecord(entry)) return [];
        const id = readText(entry.id) || `candidate-${index}`;
        return [
          {
            id,
            label: readText(entry.label) || id,
            eligible: entry.eligible === true,
            reason: readText(entry.reason),
          },
        ];
      })
    : [];
  return {
    model: readText(record.model),
    policy: readPolicy(record.policy),
    selectedAccountId: readText(record.selectedAccountId) || null,
    tiedAccountIds: Array.isArray(record.tiedAccountIds)
      ? record.tiedAccountIds.map(readText).filter(Boolean)
      : [],
    candidates,
    reason: readText(record.reason),
    note: readText(record.note),
  };
}

/** 404/501 means the backend predates the pool endpoints; anything else is a real failure. */
export const isPoolEndpointMissing = (error: unknown): boolean => {
  const status = (error as ApiError | null)?.status;
  return status === 404 || status === 501;
};

/* ---------------------------------------------------------------------------------------------
 * Fallback: the same model from the credentials list
 * ------------------------------------------------------------------------------------------- */

/** Cooldown reasons CPA records, mapped to the pool state they evidence. */
const COOLDOWN_STATES: Record<string, PoolAccountState> = {
  quota: 'rate_limited',
  credential_quota: 'rate_limited',
  payment_required: 'out_of_credits',
  invalid_grant: 'login_expired',
  unauthorized: 'login_expired',
};

const activeCooldown = (file: AuthFileItem, nowMs: number): AuthFileCooldown | null => {
  const records = file.cooldownSnapshot?.records;
  if (!records || records.length === 0) return null;
  const elapsedMs = Math.max(0, nowMs - file.cooldownSnapshot!.receivedAtMs);
  const active = records.filter((record) => {
    const retryMs = Date.parse(record.retryAt);
    if (Number.isFinite(retryMs)) return retryMs > nowMs;
    return record.remainingSeconds * 1000 > elapsedMs;
  });
  if (active.length === 0) return null;
  // Credential-wide timers describe the whole account; model timers only one model.
  return (
    active.find((record) => record.scope === 'credential') ??
    active.sort((left, right) => Date.parse(right.retryAt) - Date.parse(left.retryAt))[0]
  );
};

const credentialState = (
  file: AuthFileItem,
  nowMs: number
): { state: PoolAccountState; reason: string; resetAt: string | null } => {
  const status = readText(file.status).toLowerCase();
  if (file.disabled === true || status === 'disabled') {
    return { state: 'paused', reason: '', resetAt: null };
  }
  if (file.unavailable === true || status === 'error') {
    return { state: 'unavailable', reason: getAuthFileStatusMessage(file), resetAt: null };
  }
  const cooldown = activeCooldown(file, nowMs);
  if (cooldown) {
    const resetAt = readIsoDate(cooldown.retryAt);
    if (cooldown.scope !== 'credential') {
      // Only one model is limited; the account still serves everything else.
      return { state: 'ready', reason: cooldown.reason, resetAt };
    }
    return { state: COOLDOWN_STATES[cooldown.reason] ?? 'unavailable', reason: cooldown.reason, resetAt };
  }
  if (hasAuthFileStatusWarning(file)) {
    return { state: 'unknown', reason: getAuthFileStatusMessage(file), resetAt: null };
  }
  return { state: 'ready', reason: '', resetAt: null };
};

const providerOfFile = (file: AuthFileItem): string => {
  const candidate = readText(String(file.type ?? file.provider ?? '')).toLowerCase();
  return candidate && candidate !== 'empty' ? candidate : 'unknown';
};

/**
 * Builds pool accounts from the credentials list. Only fields the list reports are used; the
 * API key value in `account` is never read, so it cannot leak into a label.
 */
export function accountsFromCredentials(files: readonly AuthFileItem[], nowMs: number): PoolAccount[] {
  return files.map((file, index) => {
    const identity = deriveAuthFileIdentity(file);
    const { state, reason, resetAt } = credentialState(file, nowMs);
    const kind: PoolAccountKind =
      readText(String(file.account_type ?? '')).toLowerCase() === 'api_key' ? 'api_key' : 'subscription';
    const authIndex = file.authIndex === null || file.authIndex === undefined ? null : String(file.authIndex);
    // Runtime-only credentials come from the configuration; they have no file to pause or refresh.
    const runtimeOnly = file.runtimeOnly === true || file.runtimeOnly === 'true';
    return {
      id: `${identity.fullName || 'credential'}#${authIndex ?? index}`,
      provider: providerOfFile(file),
      label: identity.primary || identity.fullName,
      kind,
      state,
      reason,
      healthReason: reason,
      eligible: state === 'ready',
      priority: typeof file.priority === 'number' ? file.priority : null,
      resetAt,
      lastSuccessAt: null,
      lastFailureAt: null,
      balance: null,
      fileName: runtimeOnly ? null : identity.fullName || null,
      authIndex,
      managedIn: runtimeOnly ? 'providers' : 'credentials',
    };
  });
}

/* ---------------------------------------------------------------------------------------------
 * Summaries
 * ------------------------------------------------------------------------------------------- */

export interface PoolCapacity {
  total: number;
  ready: number;
  paused: number;
  /** API keys the policy excludes: not a health problem, and never counted as attention. */
  offByPolicy: number;
  attention: number;
}

/**
 * Policy exclusion is structural: the policy says API keys are never used, and this is an API
 * key. The backend also reports `eligible: false` and an English reason; neither is parsed.
 * A paused account stays "paused": the operator's choice is the more useful fact.
 */
export const isOffByPolicy = (account: PoolAccount, policy: PoolPolicy | null): boolean =>
  policy !== null &&
  policy.allowPaidFallback === false &&
  account.kind === 'api_key' &&
  account.state !== 'paused';

export const displayState = (
  account: PoolAccount,
  policy: PoolPolicy | null
): PoolAccountDisplayState => (isOffByPolicy(account, policy) ? 'off_by_policy' : account.state);

/** The backend's verdict: an account the pool would still hand a request to. */
export const canServe = (account: PoolAccount): boolean =>
  account.eligible && account.state !== 'paused';

export function summarizeCapacity(
  accounts: readonly PoolAccount[],
  policy: PoolPolicy | null = null
): PoolCapacity {
  let ready = 0;
  let paused = 0;
  let offByPolicy = 0;
  accounts.forEach((account) => {
    if (account.state === 'paused') paused += 1;
    else if (isOffByPolicy(account, policy)) offByPolicy += 1;
    else if (canServe(account)) ready += 1;
  });
  return {
    total: accounts.length,
    ready,
    paused,
    offByPolicy,
    attention: accounts.length - ready - paused - offByPolicy,
  };
}

export interface AttentionEntry {
  account: PoolAccount;
  state: PoolAccountState;
}

/**
 * Everything that cannot serve right now, was not paused on purpose and is not merely excluded
 * by policy. Worst first.
 */
export function attentionReasons(
  accounts: readonly PoolAccount[],
  policy: PoolPolicy | null = null
): AttentionEntry[] {
  const severity: Record<PoolAccountState, number> = {
    login_expired: 0,
    out_of_credits: 1,
    unavailable: 2,
    unknown: 3,
    rate_limited: 4,
    ready: 5,
    paused: 6,
  };
  return accounts
    .filter(
      (account) =>
        account.state !== 'paused' && !isOffByPolicy(account, policy) && !canServe(account)
    )
    .map((account) => ({ account, state: account.state }))
    .sort((left, right) => severity[left.state] - severity[right.state]);
}

export interface ProviderGroup {
  provider: string;
  accounts: PoolAccount[];
  capacity: PoolCapacity;
}

const STATE_ORDER: Record<PoolAccountState, number> = {
  ready: 0,
  rate_limited: 1,
  out_of_credits: 2,
  login_expired: 3,
  unavailable: 4,
  unknown: 5,
  paused: 6,
};

export function groupAccountsByProvider(
  accounts: readonly PoolAccount[],
  policy: PoolPolicy | null = null
): ProviderGroup[] {
  const groups = new Map<string, PoolAccount[]>();
  accounts.forEach((account) => {
    const list = groups.get(account.provider) ?? [];
    list.push(account);
    groups.set(account.provider, list);
  });
  return Array.from(groups.entries())
    .map(([provider, members]) => ({
      provider,
      accounts: [...members].sort(
        (left, right) =>
          STATE_ORDER[left.state] - STATE_ORDER[right.state] ||
          (right.priority ?? -Infinity) - (left.priority ?? -Infinity) ||
          left.label.localeCompare(right.label)
      ),
      capacity: summarizeCapacity(members, policy),
    }))
    .sort((left, right) => right.accounts.length - left.accounts.length || left.provider.localeCompare(right.provider));
}

export function successRate(totals: { requests: number; successes: number }): number | null {
  if (totals.requests <= 0) return null;
  return (totals.successes / totals.requests) * 100;
}

/* ---------------------------------------------------------------------------------------------
 * Accounts page filters
 * ------------------------------------------------------------------------------------------- */

export type AccountsFilter = 'all' | 'attention' | 'off_by_policy' | 'paused';

export const ACCOUNT_FILTERS: readonly AccountsFilter[] = [
  'all',
  'attention',
  'off_by_policy',
  'paused',
];

export function filterAccounts(
  accounts: readonly PoolAccount[],
  filter: AccountsFilter,
  search: string,
  policy: PoolPolicy | null = null
): PoolAccount[] {
  const needle = search.trim().toLowerCase();
  return accounts.filter((account) => {
    const off = isOffByPolicy(account, policy);
    if (filter === 'paused' && account.state !== 'paused') return false;
    if (filter === 'off_by_policy' && !off) return false;
    if (filter === 'attention' && (account.state === 'paused' || off || canServe(account))) {
      return false;
    }
    if (!needle) return true;
    return (
      account.label.toLowerCase().includes(needle) ||
      account.provider.toLowerCase().includes(needle) ||
      (account.fileName ?? '').toLowerCase().includes(needle)
    );
  });
}
