import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { POOL_STATS_RANGES, type PoolStatsRange } from '@/types/pool';
import styles from '../pool.module.scss';

interface RangePickerProps {
  value: PoolStatsRange;
  onChange: (range: PoolStatsRange) => void;
  disabled?: boolean;
}

/** Segmented control with arrow-key movement, as a radio group. */
export function RangePicker({ value, onChange, disabled }: RangePickerProps) {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = POOL_STATS_RANGES.indexOf(value);
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = (current + delta + POOL_STATS_RANGES.length) % POOL_STATS_RANGES.length;
    onChange(POOL_STATS_RANGES[index]);
    refs.current[index]?.focus();
  };

  return (
    <div
      className={styles.ranges}
      role="radiogroup"
      aria-label={t('pool.usage_range_aria')}
      onKeyDown={move}
    >
      {POOL_STATS_RANGES.map((range, index) => (
        <button
          key={range}
          type="button"
          role="radio"
          aria-checked={range === value}
          tabIndex={range === value ? 0 : -1}
          className={styles.chip}
          disabled={disabled}
          ref={(element) => {
            refs.current[index] = element;
          }}
          onClick={() => onChange(range)}
        >
          {t(`pool.range_${range}`)}
        </button>
      ))}
    </div>
  );
}
