import { fromOrdinal, toOrdinal } from "./chronology";
import type { PolityComparison } from "./polityComparison";
import type { HistoricalInterval } from "./types";

/** 图上一段区间的百分比位置。 */
export interface ComparisonChartBar {
  left: number;
  width: number;
}

/** 双政权时间对比图的几何数据；比例尺为双方全部存续区间的并集。 */
export interface ComparisonChart {
  range: { startYear: number; endYear: number };
  tracks: [ComparisonChartBar[], ComparisonChartBar[]];
  overlaps: ComparisonChartBar[];
  /** 当前年份落在比例尺内时的位置；否则缺省。 */
  currentYearPosition?: number;
}

/** 把双方存续区间、共同存续区间与当前年份换算为同一比例尺上的百分比位置。 */
export function buildComparisonChart(
  comparison: PolityComparison,
  currentYear?: number
): ComparisonChart {
  const periods = [...comparison.left.existencePeriods, ...comparison.right.existencePeriods];
  const start = Math.min(...periods.map(({ start: date }) => toOrdinal(date.year)));
  const end = Math.max(...periods.map(({ end: date }) => toOrdinal(date.year)));
  // 双方同为单年存续时仍保留一个序数单位，避免除以 0。
  const span = Math.max(end - start, 1);
  const toBar = (period: HistoricalInterval): ComparisonChartBar => ({
    left: ((toOrdinal(period.start.year) - start) / span) * 100,
    width: ((toOrdinal(period.end.year) - toOrdinal(period.start.year)) / span) * 100
  });
  const currentOrdinal = currentYear === undefined ? undefined : toOrdinal(currentYear);

  return {
    range: { startYear: fromOrdinal(start), endYear: fromOrdinal(end) },
    tracks: [
      comparison.left.existencePeriods.map(toBar),
      comparison.right.existencePeriods.map(toBar)
    ],
    overlaps: comparison.overlapPeriods.map(toBar),
    ...(currentOrdinal !== undefined && currentOrdinal >= start && currentOrdinal <= end
      ? { currentYearPosition: ((currentOrdinal - start) / span) * 100 }
      : {})
  };
}
