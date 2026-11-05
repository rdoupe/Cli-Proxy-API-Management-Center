/**
 * Usage & reliability: what the pool actually did over a chosen range. Everything shown comes
 * from `/pool/stats`; when the backend has no such endpoint the page says so and shows the one
 * window older backends do report.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useAuthStore } from '@/stores';
import type { PoolStatsRange } from '@/types/pool';
import { ThroughputChart } from '@/features/dashboard/components/ThroughputChart';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import { BreakdownBars } from './components/BreakdownBars';
import { LatencyChart } from './components/LatencyChart';
import { Notice } from './components/Notice';
import { RangePicker } from './components/RangePicker';
import { RequestsChart } from './components/RequestsChart';
import { StatTile } from './components/StatTile';
import {
  formatCount,
  formatLatency,
  formatRate,
  formatWindowInstant,
  providerLabel,
} from './format';
import { usePoolStats } from './hooks/usePoolStats';
import { successRate } from './logic';
import styles from './pool.module.scss';

export function UsagePage() {
  const { t, i18n } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const [range, setRange] = useState<PoolStatsRange>('24h');
  const { status, stats, error, refresh } = usePoolStats(range);
  const fallback = useDashboardOverview();
  useHeaderRefresh(refresh, connected);

  const rate = stats?.available ? successRate(stats.totals) : null;
  const unknownLabel = t('pool.provider_unknown');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('pool.usage_title')}</h1>
          <p className={styles.lede}>{t('pool.usage_lede')}</p>
          {stats?.available && stats.from && stats.to ? (
            <p className={styles.meta}>
              {t('pool.stats_window', {
                from: formatWindowInstant(stats.from, i18n.language),
                to: formatWindowInstant(stats.to, i18n.language),
              })}
            </p>
          ) : null}
        </div>
        <div className={styles.headerActions}>
          <RangePicker value={range} onChange={setRange} disabled={!connected} />
          <button
            type="button"
            className={styles.ghostAction}
            onClick={() => void refresh()}
            disabled={!connected || status === 'loading'}
            aria-label={t('pool.refresh')}
            title={t('pool.refresh')}
          >
            <IconRefreshCw size={14} className={status === 'loading' ? styles.spinning : undefined} />
          </button>
        </div>
      </header>

      {status === 'error' && error ? (
        <Notice tone="critical" title={t('pool.load_failed')}>
          {error}
        </Notice>
      ) : null}

      {status === 'unsupported' ? (
        <>
          <Notice tone="info" title={t('pool.backend_old_title')}>
            {t('pool.backend_old_usage')}
          </Notice>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t('pool.recent_title')}</h2>
              <p className={styles.sectionNote}>
                {t('pool.recent_fallback_note', { minutes: fallback.traffic.windowMinutes })}
              </p>
            </div>
            <div className={styles.panel}>
              <ThroughputChart traffic={fallback.traffic} />
            </div>
          </section>
        </>
      ) : null}

      {status === 'loading' || status === 'idle' ? (
        <div className={styles.tiles}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={styles.tile}>
              <Skeleton width={80} height={12} />
              <Skeleton width={60} height={24} />
            </div>
          ))}
        </div>
      ) : null}

      {status === 'ready' && stats && !stats.available ? (
        <Notice tone="warning" title={t('pool.stats_unavailable')}>
          {stats.reason ? t('pool.stats_unavailable_reason', { reason: stats.reason }) : null}
        </Notice>
      ) : null}

      {status === 'ready' && stats?.available ? (
        <>
          {stats.persistence === 'memory' ? (
            <Notice tone="info" title={t('pool.stats_memory_title')}>
              {t('pool.stats_memory_note')}
            </Notice>
          ) : null}
          {stats.observedSince && stats.from && Date.parse(stats.observedSince) > Date.parse(stats.from) ? (
            <p className={styles.sectionNote}>
              {t('pool.stats_since', { when: formatWindowInstant(stats.observedSince, i18n.language) })}
            </p>
          ) : null}
          <div className={styles.tiles}>
            <StatTile label={t('pool.requests')} value={formatCount(stats.totals.requests)} hint={t('pool.attempts_hint')} />
            <StatTile
              label={t('pool.success_rate')}
              value={formatRate(rate)}
              hint={t('pool.success_rate_hint', { count: stats.totals.failures })}
            />
            <StatTile label={t('pool.failovers')} value={formatCount(stats.totals.failovers)} hint={t('pool.failovers_hint')} />
            <StatTile
              label={t('pool.latency')}
              value={formatLatency(stats.totals.averageLatencyMs, t('pool.not_reported'))}
              hint={t('pool.latency_hint')}
            />
            <StatTile
              label={t('pool.tokens_in')}
              value={formatCount(stats.totals.inputTokens, t('pool.not_reported'))}
            />
            <StatTile
              label={t('pool.tokens_out')}
              value={formatCount(stats.totals.outputTokens, t('pool.not_reported'))}
            />
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t('pool.usage_requests_title')}</h2>
            </div>
            <div className={styles.panel}>
              <RequestsChart series={stats.series} range={range} />
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{t('pool.usage_latency_title')}</h2>
              <p className={styles.sectionNote}>{t('pool.usage_latency_note')}</p>
            </div>
            <div className={styles.panel}>
              <LatencyChart series={stats.series} range={range} />
            </div>
          </section>

          <div className={styles.breakdowns}>
            <div className={styles.panel}>
              <BreakdownBars
                title={t('pool.usage_by_provider')}
                rows={stats.byProvider}
                labelFor={(row) => providerLabel(row.name.toLowerCase(), unknownLabel)}
              />
            </div>
            <div className={styles.panel}>
              <BreakdownBars title={t('pool.usage_by_model')} rows={stats.byModel} />
            </div>
            <div className={styles.panel}>
              <BreakdownBars title={t('pool.usage_by_account')} rows={stats.byAccount} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
