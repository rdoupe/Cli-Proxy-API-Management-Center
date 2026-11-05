import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/ui/Collapsible';
import type { PoolSeriesPoint, PoolStatsRange } from '@/types/pool';
import { formatRate } from '../format';
import { successRate } from '../logic';
import { buildTicks, formatPointTime, labelledIndexes } from './chartScale';
import styles from '../pool.module.scss';

interface RequestsChartProps {
  series: PoolSeriesPoint[];
  range: PoolStatsRange;
}

/** Stacked columns: successes on the baseline, failures on top, with hover and a table view. */
export function RequestsChart({ series, range }: RequestsChartProps) {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<number | null>(null);

  const peak = useMemo(() => Math.max(0, ...series.map((point) => point.requests)), [series]);
  const { scaleMax, ticks } = useMemo(() => buildTicks(peak), [peak]);
  const labels = useMemo(() => labelledIndexes(series.length), [series.length]);
  const totals = useMemo(
    () =>
      series.reduce(
        (sum, point) => ({
          requests: sum.requests + point.requests,
          successes: sum.successes + point.successes,
          failures: sum.failures + point.failures,
        }),
        { requests: 0, successes: 0, failures: 0 }
      ),
    [series]
  );

  if (series.length === 0) {
    return <div className={styles.chartEmpty}>{t('pool.usage_no_points')}</div>;
  }

  const activePoint = active === null ? null : series[active];
  const summary = t('pool.usage_requests_summary', {
    total: totals.requests,
    successes: totals.successes,
    failures: totals.failures,
  });

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartLegend}>
        <span>
          <i className={styles.swatch} style={{ '--swatch': 'var(--tone-good)' } as React.CSSProperties} aria-hidden="true" />
          {t('pool.successes')}
          <b>{totals.successes.toLocaleString()}</b>
        </span>
        <span>
          <i className={styles.swatch} style={{ '--swatch': 'var(--tone-critical)' } as React.CSSProperties} aria-hidden="true" />
          {t('pool.failures')}
          <b>{totals.failures.toLocaleString()}</b>
        </span>
      </figcaption>
      <div className={styles.plot}>
        <div className={styles.yAxis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.ratio} style={{ top: `${(1 - tick.ratio) * 100}%` }}>
              {tick.value.toLocaleString()}
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
          <div className={styles.columns} role="img" aria-label={summary} onMouseLeave={() => setActive(null)}>
            {series.map((point, index) => (
              <div
                key={point.at}
                className={styles.column}
                data-active={active === index}
                tabIndex={0}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                onClick={() => setActive((current) => (current === index ? null : index))}
              >
                {point.failures > 0 && (
                  <span
                    className={`${styles.segment} ${styles.segmentFailure}`}
                    data-series="failure"
                    style={{ height: `${(point.failures / scaleMax) * 100}%` }}
                  />
                )}
                {point.successes > 0 && (
                  <span
                    className={`${styles.segment} ${styles.segmentSuccess}`}
                    data-series="success"
                    style={{ height: `${(point.successes / scaleMax) * 100}%` }}
                  />
                )}
              </div>
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
                {t('pool.successes')}
                <b>{activePoint.successes.toLocaleString()}</b>
              </span>
              <span>
                {t('pool.failures')}
                <b>{activePoint.failures.toLocaleString()}</b>
              </span>
              <span>
                {t('pool.success_rate')}
                <b>{formatRate(successRate(activePoint))}</b>
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
      <Collapsible label={t('pool.usage_table')}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('pool.usage_table_time')}</th>
              <th scope="col">{t('pool.requests')}</th>
              <th scope="col">{t('pool.successes')}</th>
              <th scope="col">{t('pool.failures')}</th>
              <th scope="col">{t('pool.success_rate')}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.at}>
                <th scope="row">{formatPointTime(point.at, range, i18n.language)}</th>
                <td>{point.requests.toLocaleString()}</td>
                <td>{point.successes.toLocaleString()}</td>
                <td>{point.failures.toLocaleString()}</td>
                <td>{formatRate(successRate(point))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Collapsible>
    </figure>
  );
}
