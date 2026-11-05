import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildSmoothLinePath } from '@/features/dashboard/components/curve';
import type { PoolSeriesPoint, PoolStatsRange } from '@/types/pool';
import { formatLatency } from '../format';
import { buildTicks, formatPointTime, labelledIndexes } from './chartScale';
import styles from '../pool.module.scss';

const VIEW_W = 100;
const VIEW_H = 100;

interface LatencyChartProps {
  series: PoolSeriesPoint[];
  range: PoolStatsRange;
}

/** Average latency per bucket as one line; buckets without a value leave a gap, not a zero. */
export function LatencyChart({ series, range }: LatencyChartProps) {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<number | null>(null);

  const known = useMemo(
    () => series.filter((point) => point.averageLatencyMs !== null),
    [series]
  );
  const peak = useMemo(() => Math.max(0, ...known.map((point) => point.averageLatencyMs ?? 0)), [known]);
  const { scaleMax, ticks } = useMemo(() => buildTicks(peak), [peak]);
  const labels = useMemo(() => labelledIndexes(series.length), [series.length]);

  const geometry = useMemo(() => {
    const step = series.length > 1 ? VIEW_W / (series.length - 1) : 0;
    const runs: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    series.forEach((point, index) => {
      if (point.averageLatencyMs === null) {
        if (current.length) runs.push(current);
        current = [];
        return;
      }
      current.push({
        x: series.length > 1 ? index * step : VIEW_W / 2,
        y: VIEW_H - (point.averageLatencyMs / scaleMax) * VIEW_H,
      });
    });
    if (current.length) runs.push(current);
    return runs;
  }, [series, scaleMax]);

  if (known.length === 0) {
    return <div className={styles.chartEmpty}>{t('pool.usage_latency_unknown')}</div>;
  }

  const activePoint = active === null ? null : series[active];

  return (
    <figure className={styles.chart}>
      <div className={styles.plot}>
        <div className={styles.yAxis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.ratio} style={{ top: `${(1 - tick.ratio) * 100}%` }}>
              {formatLatency(tick.value)}
            </span>
          ))}
        </div>
        <div className={styles.canvas}>
          {ticks.map((tick) => (
            <span
              key={tick.ratio}
              className={styles.gridline}
              style={{ top: `${(1 - tick.ratio) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          <svg
            className={styles.lineSvg}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={t('pool.usage_latency_summary', { count: known.length })}
          >
            {geometry.map((run, index) => (
              <path
                key={index}
                className={styles.linePath}
                d={buildSmoothLinePath(run, 0, VIEW_H)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {activePoint && activePoint.averageLatencyMs !== null && active !== null && (
            <svg className={styles.lineSvg} aria-hidden="true">
              <circle
                className={styles.lineDot}
                r={4}
                cx={`${((series.length > 1 ? active / (series.length - 1) : 0.5) * 100).toFixed(2)}%`}
                cy={`${(100 - (activePoint.averageLatencyMs / scaleMax) * 100).toFixed(2)}%`}
              />
            </svg>
          )}
          <div className={styles.lineHit} onMouseLeave={() => setActive(null)}>
            {series.map((point, index) => (
              <div
                key={point.at}
                className={styles.lineHitCell}
                data-active={active === index}
                tabIndex={0}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              />
            ))}
          </div>
          {activePoint && active !== null && (
            <div
              className={styles.tooltip}
              role="status"
              style={{
                left: `${((active + 0.5) / series.length) * 100}%`,
                transform:
                  active < series.length * 0.2
                    ? 'translateX(-10%)'
                    : active > series.length * 0.8
                      ? 'translateX(-90%)'
                      : 'translateX(-50%)',
              }}
            >
              <span className={styles.tooltipTime}>{formatPointTime(activePoint.at, range, i18n.language)}</span>
              <span>
                {t('pool.latency')}
                <b>{formatLatency(activePoint.averageLatencyMs, t('pool.not_reported'))}</b>
              </span>
            </div>
          )}
        </div>
      </div>
      <div className={styles.xAxis} aria-hidden="true">
        {labels.map((index) => (
          <span key={index} style={{ left: `${((index + 0.5) / series.length) * 100}%` }}>
            {formatPointTime(series[index].at, range, i18n.language)}
          </span>
        ))}
      </div>
    </figure>
  );
}
