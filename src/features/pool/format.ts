/**
 * Presentation helpers for pool pages: tones, labels and number formatting.
 * Pure functions so they can be tested without React.
 */

import type { TFunction } from 'i18next';
import type { PoolAccountState, PoolBalance } from '@/types/pool';
import { formatCompactNumber, formatPercent } from '@/utils/format';
import { providerLabel as dashboardProviderLabel } from '@/features/dashboard/utils';

export type StateTone = 'good' | 'warning' | 'critical' | 'muted';

export const STATE_TONES: Record<PoolAccountState, StateTone> = {
  ready: 'good',
  rate_limited: 'warning',
  out_of_credits: 'critical',
  login_expired: 'critical',
  unavailable: 'critical',
  unknown: 'warning',
  paused: 'muted',
};

export const stateLabel = (t: TFunction, state: PoolAccountState): string =>
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

/** Tone for a success rate: pool traffic is mostly fine, so warn early. */
export const rateTone = (rate: number | null): StateTone => {
  if (rate === null) return 'muted';
  if (rate >= 98) return 'good';
  if (rate >= 90) return 'warning';
  return 'critical';
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

/** "Back in 3 hours" only when the limit itself ends; otherwise the pool merely retries. */
export const resetLabelKey = (state: PoolAccountState): string =>
  state === 'rate_limited' || state === 'out_of_credits' ? 'pool.back_at' : 'pool.retry_at';
