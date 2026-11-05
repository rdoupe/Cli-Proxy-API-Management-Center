import { useTranslation } from 'react-i18next';
import type { PoolBreakdownRow } from '@/types/pool';
import { formatRate } from '../format';
import { successRate } from '../logic';
import styles from '../pool.module.scss';

interface BreakdownBarsProps {
  title: string;
  rows: PoolBreakdownRow[];
  labelFor?: (row: PoolBreakdownRow) => string;
}

/** Horizontal bars, longest first; each bar splits into successes and failures. */
export function BreakdownBars({ title, rows, labelFor }: BreakdownBarsProps) {
  const { t } = useTranslation();
  const sorted = [...rows].sort((left, right) => right.requests - left.requests);
  const max = Math.max(1, ...sorted.map((row) => row.requests));

  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {sorted.length === 0 ? (
        <p className={styles.sectionNote}>{t('pool.usage_no_rows')}</p>
      ) : (
        <ul className={styles.bars}>
          {sorted.map((row) => {
            const rate = successRate(row);
            return (
              <li key={row.id} className={styles.bar}>
                <span className={styles.barName}>{labelFor ? labelFor(row) : row.name}</span>
                <span className={styles.barValue}>
                  {row.requests.toLocaleString()}
                  {rate !== null ? ` · ${formatRate(rate)}` : ''}
                </span>
                <span
                  className={styles.barTrack}
                  role="img"
                  aria-label={t('pool.usage_bar_aria', {
                    name: labelFor ? labelFor(row) : row.name,
                    requests: row.requests,
                    failures: row.failures,
                  })}
                >
                  {row.successes > 0 && (
                    <span className={styles.barFill} style={{ width: `${(row.successes / max) * 100}%` }} />
                  )}
                  {row.failures > 0 && (
                    <span
                      className={`${styles.barFill} ${styles.barFillFailure}`}
                      style={{ width: `${(row.failures / max) * 100}%` }}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
