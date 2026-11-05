/**
 * Presentation helpers for pool pages: tones, labels and number formatting.
 * Pure functions so they can be tested without React.
 */

import type { TFunction } from 'i18next';
import type { PoolAccountDisplayState, PoolAccountState, PoolBalance } from '@/types/pool';
import { relativeTimeParts } from '@/utils/quota/relativeTime';
import { formatCompactNumber, formatPercent } from '@/utils/format';
import { providerLabel as dashboardProviderLabel } from '@/features/dashboard/utils';

export type StateTone = 'good' | 'warning' | 'critical' | 'muted';

export const STATE_TONES: Record<PoolAccountDisplayState, StateTone> = {
  ready: 'good',
  rate_limited: 'warning',
  out_of_credits: 'critical',
  login_expired: 'critical',
  unavailable: 'critical',
  unknown: 'warning',
  paused: 'muted',
  off_by_policy: 'muted',
};

export const stateLabel = (t: TFunction, state: PoolAccountDisplayState): string =>
  t(`pool.state.${state}`);

/** Backend reasons are machine codes sometimes; translate the known ones, show the rest as-is. */
export const reasonLabel = (t: TFunction, reason: string): string => {
  if (!reason) return '';
  const key = `pool.reason.${reason.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const translated = t(key);
  return translated === key ? reason : translated;
};

const EXTRA_PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  venice: 'Venice',
  opencode: 'OpenCode',
  anthropic: 'Claude',
};

export const providerLabel = (id: string, unknownLabel: string): string =>
  EXTRA_PROVIDER_LABELS[id] ?? dashboardProviderLabel(id, unknownLabel);

export const formatBalance = (balance: PoolBalance | null, locale?: string): string | null => {
  if (!balance || balance.amount === null) return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: balance.currency,
      maximumFractionDigits: 2,
    }).format(balance.amount);
  } catch {
    return `${balance.amount.toFixed(2)} ${balance.currency}`;
  }
};

export const formatCount = (value: number | null, dash = '—'): string =>
  value === null ? dash : value < 100_000 ? value.toLocaleString() : formatCompactNumber(value);

export const formatRate = (value: number | null, dash = '—'): string =>
  value === null ? dash : formatPercent(value);

export const formatLatency = (ms: number | null, dash = '—'): string => {
  if (ms === null) return dash;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
};

/** Window bounds without seconds: "Nov 3, 10:00". */
export const formatWindowInstant = (iso: string | null, locale?: string): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * "Back in 3 hours" only when the limit itself ends. An out-of-credits `resetAt` is the time of
 * the automatic recheck, which may fail again, so it is never promised as "back"; anything else
 * is merely a retry.
 */
export const resetLabelKey = (state: PoolAccountState): string => {
  if (state === 'rate_limited') return 'pool.back_at';
  if (state === 'out_of_credits') return 'pool.recheck_at';
  return 'pool.retry_at';
};

/**
 * Relative phrase for an instant that is known to be in the past (a check, a last success).
 *
 * `nowMs` ticks once a minute, so an event from twenty seconds ago can sit ahead of it and read
 * "in 1 minute". The baseline is therefore the later of the shared clock and the real clock,
 * and the instant is clamped under it, so the phrase is always "… ago".
 */
export const formatPastInstant = (
  targetMs: number,
  nowMs: number,
  locale?: string,
  realNowMs: number = Date.now()
): string => {
  const baseline = Math.max(nowMs, realNowMs);
  const { value, unit } = relativeTimeParts(Math.min(targetMs, baseline - 1), baseline);
  return relativeFormatter(locale).format(value, unit);
};

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();
const relativeFormatter = (locale?: string): Intl.RelativeTimeFormat => {
  const key = locale ?? '';
  let formatter = relativeFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
    } catch {
      formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' });
    }
    relativeFormatters.set(key, formatter);
  }
  return formatter;
};
