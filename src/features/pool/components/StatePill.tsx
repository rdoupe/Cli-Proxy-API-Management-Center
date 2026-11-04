import { useTranslation } from 'react-i18next';
import type { PoolAccountState } from '@/types/pool';
import { STATE_TONES, stateLabel } from '../format';
import styles from '../pool.module.scss';

const TONE_VARS: Record<string, string> = {
  good: 'var(--tone-good)',
  warning: 'var(--tone-warning)',
  critical: 'var(--tone-critical)',
  muted: 'var(--tone-muted)',
};

export function StatePill({ state }: { state: PoolAccountState }) {
  const { t } = useTranslation();
  const tone = STATE_TONES[state];
  return (
    <span
      className={styles.pill}
      data-tone={tone}
      style={{ '--pill-tone': TONE_VARS[tone] } as React.CSSProperties}
    >
      {stateLabel(t, state)}
    </span>
  );
}
