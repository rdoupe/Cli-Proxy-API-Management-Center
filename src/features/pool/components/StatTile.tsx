import type { StateTone } from '../format';
import styles from '../pool.module.scss';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: StateTone;
}

export function StatTile({ label, value, hint, tone }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <strong className={styles.tileValue} data-tone={tone}>
        {value}
      </strong>
      {hint ? <span className={styles.tileHint}>{hint}</span> : null}
    </div>
  );
}
