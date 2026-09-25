import type { HistoricalYearBounds } from "./browseState";
import { formatHistoricalYear, fromOrdinal, toOrdinal } from "./chronology";
import { buildTimelineAxis, type TimelineAxis, type TimelineAxisRange } from "./timelineAxis";
import type { HistoricalInterval } from "./types";

/** 全览时间轴放大后的闭区间时间窗口。 */
export interface TimeWindow {
  startYear: number;
  endYear: number;
}

/** 时间窗口的最小跨度（连续序数单位，即年数）。 */
export const MIN_TIME_WINDOW_SPAN = 10;

/** 缩小一级时窗口跨度的放大倍数。 */
const ZOOM_OUT_FACTOR = 3;

/** 可点击放大的一段刻度区间及其在轨道上的百分比位置。 */
export interface ZoomSegment extends TimeWindow {
  left: number;
  width: number;
}

function isHistoricalYear(year: number): boolean {
  return Number.isSafeInteger(year) && year !== 0;
}

/**
 * 清洗时间窗口：端点裁剪到数据范围，跨度不足或端点非法时返回 null；
 * 覆盖完整数据范围的窗口等同未放大，也返回 null。
 */
export function sanitizeTimeWindow(
  startYear: number,
  endYear: number,
  bounds: HistoricalYearBounds
): TimeWindow | null {
  if (!isHistoricalYear(startYear) || !isHistoricalYear(endYear)) return null;
  const start = Math.max(toOrdinal(startYear), toOrdinal(bounds.min));
  const end = Math.min(toOrdinal(endYear), toOrdinal(bounds.max));
  if (end - start < MIN_TIME_WINDOW_SPAN) return null;
  if (start <= toOrdinal(bounds.min) && end >= toOrdinal(bounds.max)) return null;
  return { startYear: fromOrdinal(start), endYear: fromOrdinal(end) };
}

/** 存在区间与时间窗口是否有交集；两端均包含。 */
export function isPeriodInTimeWindow(period: HistoricalInterval, window: TimeWindow): boolean {
  return (
    toOrdinal(period.start.year) <= toOrdinal(window.endYear) &&
    toOrdinal(period.end.year) >= toOrdinal(window.startYear)
  );
}

/** 以区间端点和刻度切分出可放大的分段，舍弃不足最小跨度的分段。 */
export function listZoomSegments(range: TimelineAxisRange, axis: TimelineAxis): ZoomSegment[] {
  const startOrdinal = toOrdinal(range.startYear);
  const span = toOrdinal(range.endYear) - startOrdinal;
  if (span <= 0) return [];
  const boundaries = [range.startYear, ...axis.ticks.map(({ year }) => year), range.endYear]
    .map(toOrdinal)
    .filter((ordinal, index, all) => index === 0 || ordinal > (all[index - 1] ?? ordinal));

  return boundaries.slice(1).flatMap((end, index): ZoomSegment[] => {
    const start = boundaries[index] ?? end;
    if (end - start < MIN_TIME_WINDOW_SPAN) return [];
    return [
      {
        startYear: fromOrdinal(start),
        endYear: fromOrdinal(end),
        left: ((start - startOrdinal) / span) * 100,
        width: ((end - start) / span) * 100
      }
    ];
  });
}

/** 把年份向外取整到刻度间隔；取整落在不存在的公元 0 年时改用相邻的历史年份。 */
function snapOutward(year: number, step: number, direction: "down" | "up"): number {
  const snapped =
    direction === "down" ? Math.floor(year / step) * step : Math.ceil(year / step) * step;
  if (snapped !== 0) return snapped;
  return direction === "down" ? 1 : -1;
}

/**
 * 以窗口中心将跨度扩大约 3 倍，贴近数据边界时整体平移，
 * 再按新范围的刻度间隔向外取整；覆盖完整数据范围时返回 null。
 */
export function zoomOutTimeWindow(
  window: TimeWindow,
  bounds: HistoricalYearBounds
): TimeWindow | null {
  const minOrdinal = toOrdinal(bounds.min);
  const maxOrdinal = toOrdinal(bounds.max);
  const start = toOrdinal(window.startYear);
  const end = toOrdinal(window.endYear);
  const nextSpan = (end - start) * ZOOM_OUT_FACTOR;
  if (nextSpan >= maxOrdinal - minOrdinal) return null;

  let nextStart = Math.round((start + end) / 2 - nextSpan / 2);
  let nextEnd = nextStart + nextSpan;
  if (nextStart < minOrdinal) {
    nextEnd += minOrdinal - nextStart;
    nextStart = minOrdinal;
  }
  if (nextEnd > maxOrdinal) {
    nextStart -= nextEnd - maxOrdinal;
    nextEnd = maxOrdinal;
  }

  const unsnapped = { startYear: fromOrdinal(nextStart), endYear: fromOrdinal(nextEnd) };
  const { step } = buildTimelineAxis(unsnapped);
  return sanitizeTimeWindow(
    snapOutward(unsnapped.startYear, step, "down"),
    snapOutward(unsnapped.endYear, step, "up"),
    bounds
  );
}

/** 时间窗口的中文纪年文案，例如“前221—220”。 */
export function formatTimeWindow(window: TimeWindow): string {
  return `${formatHistoricalYear({ year: window.startYear, precision: "exact" })}—${formatHistoricalYear({ year: window.endYear, precision: "exact" })}`;
}
