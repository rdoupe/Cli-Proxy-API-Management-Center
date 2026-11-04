import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PoolAccount } from '@/types/pool';
import { formatRelativeInstant } from '@/utils/quota/relativeTime';
import { formatDateTimeValue } from '@/utils/format';
import { STATE_TONES, formatBalance, reasonLabel, resetLabelKey } from '../format';
import type { PoolAccountAction } from '../hooks/usePoolOverview';
import { availableActions } from '../accountActions';
import { StatePill } from './StatePill';
import styles from '../pool.module.scss';

const TONE_VARS: Record<string, string> = {
  good: 'var(--tone-good)',
  warning: 'var(--tone-warning)',
  critical: 'var(--tone-critical)',
  muted: 'var(--tone-muted)',
};

interface AccountRowProps {
  account: PoolAccount;
  nowMs: number;
  busy: boolean;
  disabled: boolean;
  onAction: (action: PoolAccountAction, account: PoolAccount) => void;
}

export function AccountRow({ account, nowMs, busy, disabled, onAction }: AccountRowProps) {
  const { t, i18n } = useTranslation();
  const tone = STATE_TONES[account.state];
  const actions = availableActions(account);
  const reason = reasonLabel(t, account.reason);
  const resetMs = account.resetAt ? Date.parse(account.resetAt) : NaN;
  const balance = formatBalance(account.balance, i18n.language);
  const needsReconnect = account.kind === 'subscription' && (account.state === 'login_expired' || account.state === 'unavailable');

  return (
    <div className={styles.row} data-account-id={account.id}>
      <i className={styles.rowDot} data-tone={tone} style={{ '--dot-tone': TONE_VARS[tone] } as React.CSSProperties} aria-hidden="true" />
      <div className={styles.rowIdentity}>
        <span className={styles.rowLabel}>
          <span title={account.fileName ?? account.label}>{account.label}</span>
          <span className={styles.kind}>
            {account.kind === 'api_key' ? t('pool.kind_api_key') : t('pool.kind_subscription')}
          </span>
        </span>
        <span className={styles.rowSub}>
          {account.priority !== null ? (
            <span>{t('pool.priority', { value: account.priority })}</span>
          ) : null}
          {balance ? <span>{t('pool.balance', { value: balance })}</span> : null}
          {account.lastSuccessAt ? (
            <span title={formatDateTimeValue(account.lastSuccessAt, i18n.language)}>
              {t('pool.last_success', {
                when: formatRelativeInstant(Date.parse(account.lastSuccessAt), nowMs, i18n.language),
              })}
            </span>
          ) : null}
        </span>
      </div>
      <div className={styles.rowState}>
        <StatePill state={account.state} />
        {reason ? <span className={styles.rowReason}>{reason}</span> : null}
        {Number.isFinite(resetMs) && resetMs > nowMs ? (
          <span className={styles.rowReason} title={formatDateTimeValue(account.resetAt, i18n.language)}>
            {t(resetLabelKey(account.state), { when: formatRelativeInstant(resetMs, nowMs, i18n.language) })}
          </span>
        ) : null}
      </div>
      <div className={styles.rowActions}>
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className={styles.rowAction}
            disabled={disabled || busy}
            onClick={() => onAction(action, account)}
          >
            {t(`pool.action_${action}`)}
          </button>
        ))}
        {needsReconnect ? (
          <Link to="/oauth" className={styles.rowAction}>
            {t('pool.action_reconnect')}
          </Link>
        ) : null}
        {!account.fileName ? (
          <Link to="/ai-providers" className={styles.rowAction}>
            {t('pool.action_manage_providers')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
