/**
 * Accounts: every login and key in the pool, grouped by service, with its state in words and
 * the actions this backend supports for it.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useNow } from '@/hooks/useNow';
import { useAuthStore, useNotificationStore } from '@/stores';
import type { PoolAccount } from '@/types/pool';
import { getErrorMessage } from '@/utils/helpers';
import { AccountRow } from './components/AccountRow';
import { Notice } from './components/Notice';
import { ProviderMark } from './components/ProviderMark';
import { providerLabel } from './format';
import { usePoolOverview, type PoolAccountAction } from './hooks/usePoolOverview';
import {
  ACCOUNT_FILTERS,
  filterAccounts,
  groupAccountsByProvider,
  summarizeCapacity,
  type AccountsFilter,
} from './logic';
import styles from './pool.module.scss';

export function AccountsPage() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const showNotification = useNotificationStore((state) => state.showNotification);
  const nowMs = useNow(connected);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const filter: AccountsFilter = ACCOUNT_FILTERS.includes(filterParam as AccountsFilter)
    ? (filterParam as AccountsFilter)
    : 'all';
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { status, overview, unsupported, error, refresh, act } = usePoolOverview();
  useHeaderRefresh(refresh, connected);

  const accounts = useMemo(() => overview?.accounts ?? [], [overview]);
  const capacity = useMemo(() => summarizeCapacity(accounts), [accounts]);
  const visible = useMemo(() => filterAccounts(accounts, filter, search), [accounts, filter, search]);
  const groups = useMemo(() => groupAccountsByProvider(visible), [visible]);
  const unknownLabel = t('pool.provider_unknown');

  const setFilter = (next: AccountsFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('filter');
    else params.set('filter', next);
    setSearchParams(params, { replace: true });
  };

  const handleAction = useCallback(
    async (action: PoolAccountAction, account: PoolAccount) => {
      setBusyId(account.id);
      try {
        await act(action, account);
        showNotification(t(`pool.action_done_${action}`, { account: account.label }), 'success');
      } catch (actionError) {
        showNotification(getErrorMessage(actionError, t('common.unknown_error')), 'error');
      } finally {
        setBusyId(null);
      }
    },
    [act, showNotification, t]
  );

  const counts = {
    all: capacity.total,
    attention: capacity.attention,
    paused: capacity.paused,
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('pool.accounts_title')}</h1>
          <p className={styles.lede}>
            {status === 'ready'
              ? t('pool.accounts_lede', { ready: capacity.ready, total: capacity.total })
              : t('pool.overview_loading')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/oauth" className={styles.primaryAction}>
            {t('pool.add_signin')}
          </Link>
          <Link to="/ai-providers" className={styles.ghostAction}>
            {t('pool.add_api_key')}
          </Link>
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

      {error ? (
        <Notice tone="critical" title={t('pool.load_failed')}>
          {error}
        </Notice>
      ) : null}
      {unsupported && status === 'ready' ? (
        <Notice tone="info" title={t('pool.backend_old_title')}>
          {t('pool.backend_old_accounts')}
        </Notice>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.chips} role="group" aria-label={t('pool.filter_aria')}>
          {ACCOUNT_FILTERS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={styles.chip}
              aria-pressed={filter === entry}
              onClick={() => setFilter(entry)}
            >
              {t(`pool.filter_${entry}`)}
              <span>{counts[entry]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className={styles.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('pool.search_placeholder')}
          aria-label={t('pool.search_placeholder')}
        />
      </div>

      {status === 'loading' || status === 'idle' ? (
        <div className={styles.group}>
          <div className={styles.groupHead}>
            <Skeleton width={120} height={16} />
          </div>
          <div className={styles.row}>
            <Skeleton width="100%" height={18} />
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className={styles.group}>
          <p className={styles.emptyRow}>
            {capacity.total === 0 ? t('pool.overview_empty_hint') : t('pool.accounts_no_match')}
          </p>
        </div>
      ) : (
        groups.map((group) => {
          const name = providerLabel(group.provider, unknownLabel);
          return (
            <section key={group.provider} className={styles.group} aria-label={name}>
              <header className={styles.groupHead}>
                <ProviderMark provider={group.provider} label={name} />
                <span className={styles.groupName}>{name}</span>
                <span className={styles.groupMeta}>
                  {t('pool.strip_group_ready', { ready: group.capacity.ready, total: group.capacity.total })}
                </span>
              </header>
              {group.accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  nowMs={nowMs}
                  busy={busyId === account.id}
                  disabled={!connected}
                  onAction={(action, target) => void handleAction(action, target)}
                />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
