import type { PoolStatsRange } from '@/types/pool';
import { axisMax } from '@/features/dashboard/utils';

export const TICK_COUNT = 5;

export interface AxisTick {
  ratio: number;
  value: number;
}

export function buildTicks(peak: number): { scaleMax: number; ticks: AxisTick[] } {
  const scaleMax = Math.max(1, axisMax(peak, TICK_COUNT - 1));
  const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const ratio = 1 - index / (TICK_COUNT - 1);
    return { ratio, value: Math.round(scaleMax * ratio) };
  });
  return { scaleMax, ticks };
}

/** Which points get an x-axis label: first, middle, last. */
export function labelledIndexes(count: number): number[] {
  if (count === 0) return [];
  return Array.from(new Set([0, Math.floor((count - 1) / 2), count - 1]));
}

/** Short time label matched to the range so a 30-day axis shows dates, not minutes. */
export function formatPointTime(iso: string, range: PoolStatsRange, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (range === '7d' || range === '30d') {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}
