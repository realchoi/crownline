import { toOrdinal } from "./chronology";

/** 候选刻度间隔（年），从细到粗依次尝试。 */
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000] as const;

/** 时间轴刻度的闭区间范围。 */
export interface TimelineAxisRange {
  startYear: number;
  endYear: number;
}

/** 单个刻度：历史年份及其在轨道上的百分比位置。 */
export interface TimelineAxisTick {
  year: number;
  position: number;
}

/** 一组等间隔整数年代刻度。 */
export interface TimelineAxis {
  step: number;
  ticks: TimelineAxisTick[];
}

/**
 * 列出区间内落在 step 整数倍上的历史年份。
 * 不存在公元 0 年，该位置改用公元 1 年标记公元前后分界。
 */
function listTickYears(range: TimelineAxisRange, step: number): number[] {
  const startOrdinal = toOrdinal(range.startYear);
  const endOrdinal = toOrdinal(range.endYear);
  const years: number[] = [];
  for (
    let multiple = Math.ceil(range.startYear / step);
    multiple <= Math.floor(range.endYear / step);
    multiple += 1
  ) {
    const year = multiple === 0 ? 1 : multiple * step;
    const ordinal = toOrdinal(year);
    if (ordinal < startOrdinal || ordinal > endOrdinal || years.at(-1) === year) continue;
    years.push(year);
  }
  return years;
}

/** 为时间轴选取不超过 maxTicks 个的最细整数年代刻度，并换算为轨道百分比位置。 */
export function buildTimelineAxis(range: TimelineAxisRange, maxTicks = 8): TimelineAxis {
  const startOrdinal = toOrdinal(range.startYear);
  const span = toOrdinal(range.endYear) - startOrdinal;
  const coarsestStep = TICK_STEPS[TICK_STEPS.length - 1] ?? 1;
  if (span <= 0) return { step: coarsestStep, ticks: [] };

  const step =
    TICK_STEPS.find((candidate) => {
      // 整数倍个数只会因公元 0 年去重多出 1 个，先粗筛避免细间隔下逐年枚举。
      const multiples =
        Math.floor(range.endYear / candidate) - Math.ceil(range.startYear / candidate) + 1;
      return multiples <= maxTicks + 1 && listTickYears(range, candidate).length <= maxTicks;
    }) ?? coarsestStep;
  return {
    step,
    ticks: listTickYears(range, step).map((year) => ({
      year,
      position: ((toOrdinal(year) - startOrdinal) / span) * 100
    }))
  };
}
