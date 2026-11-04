import { useTranslation } from 'react-i18next';
import type { PoolAccount } from '@/types/pool';
import { STATE_TONES, providerLabel, stateLabel } from '../format';
import { groupAccountsByProvider } from '../logic';
import { ProviderMark } from './ProviderMark';
import styles from '../pool.module.scss';

const TONE_VARS: Record<string, string> = {
  good: 'var(--tone-good)',
  warning: 'var(--tone-warning)',
  critical: 'var(--tone-critical)',
  muted: 'var(--tone-muted)',
};

interface CapacityStripProps {
  accounts: readonly PoolAccount[];
  onSelect?: (account: PoolAccount) => void;
}

/**
 * One cell per account, grouped under its provider, coloured by state. The whole pool's
 * readiness in a glance; dashed cells are paused on purpose.
 */
export function CapacityStrip({ accounts, onSelect }: CapacityStripProps) {
  const { t } = useTranslation();
  const groups = groupAccountsByProvider(accounts);
  const unknownLabel = t('pool.provider_unknown');

  const legend = (['ready', 'rate_limited', 'out_of_credits', 'login_expired', 'unavailable', 'unknown', 'paused'] as const)
    .map((state) => ({ state, count: accounts.filter((account) => account.state === state).length }))
    .filter((entry) => entry.count > 0);

  return (
    <div className={styles.strip}>
      <div className={styles.stripRow} role="list" aria-label={t('pool.strip_aria')}>
        {groups.map((group) => {
          const name = providerLabel(group.provider, unknownLabel);
          return (
            <div
              key={group.provider}
              className={styles.stripGroup}
              role="listitem"
              style={{ flexGrow: group.accounts.length }}
            >
              <span className={styles.stripGroupLabel}>
                <ProviderMark provider={group.provider} label={name} />
                {name}
                <b>
                  {t('pool.strip_group_ready', {
                    ready: group.capacity.ready,
                    total: group.capacity.total,
                  })}
                </b>
              </span>
              <div className={styles.stripCells}>
                {group.accounts.map((account) => {
                  const tone = STATE_TONES[account.state];
                  const title = `${account.label} · ${stateLabel(t, account.state)}`;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      className={styles.stripCell}
                      data-tone={tone}
                      style={{ '--cell-tone': TONE_VARS[tone] } as React.CSSProperties}
                      title={title}
                      aria-label={title}
                      onClick={() => onSelect?.(account)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <ul className={styles.stripLegend}>
        {legend.map((entry) => (
          <li key={entry.state}>
            <i
              className={styles.swatch}
              data-tone={STATE_TONES[entry.state]}
              style={{ '--swatch': TONE_VARS[STATE_TONES[entry.state]] } as React.CSSProperties}
              aria-hidden="true"
            />
            {stateLabel(t, entry.state)}
            <b>{entry.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
