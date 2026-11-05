import { useTranslation } from 'react-i18next';
import type { PoolAccountDisplayState } from '@/types/pool';
import { STATE_TONES, stateLabel } from '../format';
import styles from '../pool.module.scss';

const TONE_VARS: Record<string, string> = {
  good: 'var(--tone-good)',
  warning: 'var(--tone-warning)',
  critical: 'var(--tone-critical)',
  muted: 'var(--tone-muted)',
};

export function StatePill({ state }: { state: PoolAccountDisplayState }) {
  const { t } = useTranslation();
  const tone = STATE_TONES[state];
  return (
    <span
      className={styles.pill}
      data-tone={tone}
      data-state={state}
      style={{ '--pill-tone': TONE_VARS[tone] } as React.CSSProperties}
    >
      {stateLabel(t, state)}
    </span>
  );
}
