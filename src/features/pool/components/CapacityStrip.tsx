import { useTranslation } from 'react-i18next';
import type { PoolAccount, PoolAccountDisplayState, PoolPolicy } from '@/types/pool';
import { STATE_TONES, providerLabel, stateLabel } from '../format';
import { displayState, groupAccountsByProvider } from '../logic';
import { ProviderMark } from './ProviderMark';
import styles from '../pool.module.scss';

const TONE_VARS: Record<string, string> = {
  good: 'var(--tone-good)',
  warning: 'var(--tone-warning)',
  critical: 'var(--tone-critical)',
  muted: 'var(--tone-muted)',
};

const LEGEND_ORDER: readonly PoolAccountDisplayState[] = [
  'ready',
  'rate_limited',
  'out_of_credits',
  'login_expired',
  'unavailable',
  'unknown',
  'off_by_policy',
  'paused',
];

interface CapacityStripProps {
  accounts: readonly PoolAccount[];
  /** Needed to tell a policy-excluded key from a healthy one; null on older backends. */
  policy?: PoolPolicy | null;
  onSelect?: (account: PoolAccount) => void;
}

/**
 * One cell per account, grouped under its provider, coloured by what it is doing: dashed
 * cells are paused on purpose or excluded by policy, and the legend counts the same states
 * the group headers and the pages do.
 */
export function CapacityStrip({ accounts, policy = null, onSelect }: CapacityStripProps) {
  const { t } = useTranslation();
  const groups = groupAccountsByProvider(accounts, policy);
  const unknownLabel = t('pool.provider_unknown');

  const legend = LEGEND_ORDER.map((state) => ({
    state,
    count: accounts.filter((account) => displayState(account, policy) === state).length,
  })).filter((entry) => entry.count > 0);

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
                  const state = displayState(account, policy);
                  const tone = STATE_TONES[state];
                  const title = `${account.label} · ${stateLabel(t, state)}`;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      className={styles.stripCell}
                      data-tone={tone}
                      data-state={state}
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
