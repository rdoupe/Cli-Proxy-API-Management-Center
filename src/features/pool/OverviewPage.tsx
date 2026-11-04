/**
 * Overview: can the pool take requests right now, what needs a hand, how it has been going,
 * and the policy that decides who serves. Reads `/pool/overview`; on older backends the same
 * picture is derived from the credentials list and says so.
 */

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconCheckCircle2, IconRefreshCw } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useNow } from '@/hooks/useNow';
import { useAuthStore } from '@/stores';
import { formatRelativeInstant } from '@/utils/quota/relativeTime';
import { ThroughputChart } from '@/features/dashboard/components/ThroughputChart';
import { CapacityStrip } from './components/CapacityStrip';
import { Notice } from './components/Notice';
import { PolicyCard } from './components/PolicyCard';
import { StatePill } from './components/StatePill';
import { StatTile } from './components/StatTile';
import {
  formatCount,
  formatLatency,
  formatRate,
  rateTone,
  reasonLabel,
  resetLabelKey,
} from './format';
import { usePoolOverview } from './hooks/usePoolOverview';
import { attentionReasons, successRate, summarizeCapacity } from './logic';
import styles from './pool.module.scss';

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const nowMs = useNow(connected);
  const { status, overview, unsupported, error, recentTraffic, refresh } = usePoolOverview();
  useHeaderRefresh(refresh, connected);

  const accounts = useMemo(() => overview?.accounts ?? [], [overview]);
  const capacity = useMemo(() => summarizeCapacity(accounts), [accounts]);
  const attention = useMemo(() => attentionReasons(accounts), [accounts]);
  const stats = overview?.stats ?? null;
  const rate = stats && stats.available ? successRate(stats) : null;

  const observed = overview?.observedAt
    ? t('pool.observed', {
        when: formatRelativeInstant(Date.parse(overview.observedAt), nowMs, i18n.language),
      })
    : null;

  const lede = !connected
    ? t('pool.overview_offline')
    : status === 'loading' || status === 'idle'
      ? t('pool.overview_loading')
      : capacity.total === 0
        ? t('pool.overview_empty')
        : capacity.ready === 0
          ? t('pool.overview_none_ready', { total: capacity.total })
          : t('pool.overview_ready', { ready: capacity.ready, total: capacity.total });


  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('pool.overview_title')}</h1>
          <p className={styles.lede}>
            {lede}
            {connected && status === 'ready' && capacity.attention > 0 ? (
              <>
                {' '}
                <b>{t('pool.overview_attention', { count: capacity.attention })}</b>
              </>
            ) : null}
          </p>
          {observed ? (
            <p className={styles.meta}>
              {observed}
              {overview?.source === 'credentials' ? ` · ${t('pool.source_credentials')}` : ''}
            </p>
          ) : null}
        </div>
        <div className={styles.headerActions}>
          <Link to="/accounts" className={styles.ghostAction}>
            {t('pool.cta_accounts')}
          </Link>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => void refresh()}
            disabled={!connected || status === 'loading'}
          >
            <IconRefreshCw size={14} className={status === 'loading' ? styles.spinning : undefined} />
            {t('pool.refresh')}
          </button>
        </div>
      </header>

      {error ? (
        <Notice tone="critical" title={t('pool.load_failed')}>
          {error}
        </Notice>
      ) : null}

      {unsupported && status === 'ready' ? (
        <Notice tone="info" title={t('pool.backend_old_title')}>
          {t('pool.backend_old_overview')}
        </Notice>
      ) : null}

      {status === 'loading' || status === 'idle' ? (
        <div className={styles.panel}>
          <Skeleton height={26} />
        </div>
      ) : capacity.total > 0 ? (
        <section className={styles.panel} aria-label={t('pool.strip_aria')}>
          <CapacityStrip accounts={accounts} onSelect={() => navigate('/accounts')} />
        </section>
      ) : status === 'ready' ? (
        <section className={styles.panel}>
          <p className={styles.emptyRow}>{t('pool.overview_empty_hint')}</p>
          <div className={styles.headerActions}>
            <Link to="/oauth" className={styles.primaryAction}>
              {t('pool.add_signin')}
            </Link>
            <Link to="/ai-providers" className={styles.ghostAction}>
              {t('pool.add_api_key')}
            </Link>
          </div>
        </section>
      ) : null}

      <div className={styles.twoUp}>
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t('pool.attention_title')}</h2>
            <Link to="/accounts?filter=attention" className={styles.sectionLink}>
              {t('pool.attention_link')}
            </Link>
          </div>
          <div className={styles.panel}>
            {attention.length === 0 ? (
              <p className={styles.allGood}>
                <IconCheckCircle2 size={18} />
                {status === 'ready' ? t('pool.attention_none') : t('pool.overview_loading')}
              </p>
            ) : (
              <ul className={styles.attentionList}>
                {attention.slice(0, 6).map(({ account }) => (
                  <li key={account.id} className={styles.attentionItem}>
                    <StatePill state={account.state} />
                    <div className={styles.attentionCopy}>
                      <span className={styles.attentionTitle}>{account.label}</span>
                      <span className={styles.attentionReason}>
                        {reasonLabel(t, account.reason) || t(`pool.state_hint.${account.state}`)}
                        {account.resetAt && Date.parse(account.resetAt) > nowMs
                          ? ` · ${t(resetLabelKey(account.state), {
                              when: formatRelativeInstant(Date.parse(account.resetAt), nowMs, i18n.language),
                            })}`
                          : ''}
                      </span>
                    </div>
                    <Link to="/accounts" className={styles.sectionLink}>
                      {t('pool.attention_open')}
                    </Link>
                  </li>
                ))}
                {attention.length > 6 ? (
                  <li className={styles.attentionItem}>
                    <span />
                    <span className={styles.attentionReason}>
                      {t('pool.attention_more', { count: attention.length - 6 })}
                    </span>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{t('pool.policy_title')}</h2>
          </div>
          <div className={styles.panel}>
            <PolicyCard policy={overview?.policy ?? null} />
          </div>
        </section>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{t('pool.recent_title')}</h2>
          <Link to="/usage" className={styles.sectionLink}>
            {t('pool.recent_link')}
          </Link>
        </div>
        {stats?.available ? (
          <>
            <div className={styles.tiles}>
              <StatTile label={t('pool.requests')} value={formatCount(stats.requests)} hint={t('pool.attempts_hint')} />
              <StatTile label={t('pool.success_rate')} value={formatRate(rate)} tone={rateTone(rate)} hint={t('pool.failures_hint', { count: stats.failures })} />
              <StatTile label={t('pool.failovers')} value={formatCount(stats.failovers)} hint={t('pool.failovers_hint')} />
              <StatTile label={t('pool.latency')} value={formatLatency(stats.averageLatencyMs, t('pool.not_reported'))} hint={t('pool.latency_hint')} />
            </div>
          </>
        ) : (
          <div className={styles.panel}>
            <p className={styles.sectionNote}>
              {unsupported
                ? t('pool.recent_fallback_note', { minutes: recentTraffic.windowMinutes })
                : stats?.reason
                  ? t('pool.stats_unavailable_reason', { reason: stats.reason })
                  : t('pool.stats_unavailable')}
            </p>
            {unsupported ? (
              <div style={{ marginTop: 12 }}>
                <ThroughputChart traffic={recentTraffic} />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
