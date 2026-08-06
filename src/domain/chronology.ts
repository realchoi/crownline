import type { HistoricalDate, HistoricalInterval } from "./types";

/** 确保进入纪年运算的年份是有效历史年份。 */
function assertHistoricalYear(year: number): void {
  if (!Number.isInteger(year)) {
    throw new Error("历史年份必须是整数");
  }
  if (year === 0) {
    throw new Error("历史年份不存在公元 0 年");
  }
}

/**
 * 将历史年份转换为连续序数。
 * 该序数会压缩不存在的公元 0 年，便于比较、求跨度和计算位置。
 */
export function toOrdinal(year: number): number {
  assertHistoricalYear(year);
  return year < 0 ? year + 1 : year;
}

/** 将连续序数还原为不含公元 0 年的历史年份。 */
export function fromOrdinal(ordinal: number): number {
  if (!Number.isInteger(ordinal)) {
    throw new Error("历史年份序数必须是整数");
  }
  return ordinal <= 0 ? ordinal - 1 : ordinal;
}

/** 返回下一历史年份；公元前 1 年之后直接进入公元 1 年。 */
export function nextHistoricalYear(year: number): number {
  assertHistoricalYear(year);
  return year === -1 ? 1 : year + 1;
}

/** 返回上一历史年份；公元 1 年之前直接进入公元前 1 年。 */
export function previousHistoricalYear(year: number): number {
  assertHistoricalYear(year);
  return year === 1 ? -1 : year - 1;
}

/**
 * 解析用户输入的历史年份。
 * 支持“前221”“公元前 221”“-221”“221”和“公元 221”。
 */
export function parseHistoricalYear(value: string): number | null {
  const normalized = value.trim();
  const beforeCommonEra = normalized.match(/^(?:公元前|前)\s*(\d+)$/);
  const commonEra = normalized.match(/^(?:公元\s*)?(\d+)$/);
  const signedBeforeCommonEra = normalized.match(/^-(\d+)$/);
  const digits = beforeCommonEra?.[1] ?? signedBeforeCommonEra?.[1] ?? commonEra?.[1];
  if (!digits) return null;

  const absoluteYear = Number(digits);
  if (!Number.isSafeInteger(absoluteYear) || absoluteYear === 0) return null;
  return beforeCommonEra || signedBeforeCommonEra ? -absoluteYear : absoluteYear;
}

/** 判断实体是否在指定年份内的任一时刻存在。 */
export function isYearInPeriods(year: number, periods: HistoricalInterval[]): boolean {
  const ordinal = toOrdinal(year);
  return periods.some((period) => {
    return ordinal >= toOrdinal(period.start.year) && ordinal <= toOrdinal(period.end.year);
  });
}

/** 累加多个存在区间的实际持续年数，不把中断期计入结果。 */
export function calculatePeriodsDuration(periods: HistoricalInterval[]): number {
  return periods.reduce((total, period) => {
    return total + toOrdinal(period.end.year) - toOrdinal(period.start.year) + 1;
  }, 0);
}

/** 按中文传统纪年习惯格式化单个历史年份。 */
export function formatHistoricalYear(date: HistoricalDate): string {
  assertHistoricalYear(date.year);
  const prefix = date.precision === "exact" ? "" : "约";
  const year = date.year < 0 ? `前${Math.abs(date.year)}` : String(date.year);
  return `${prefix}${year}`;
}

/** 格式化一个或多个存在区间；显式展示文案具有最高优先级。 */
export function formatPeriods(periods: HistoricalInterval[], override?: string): string {
  if (override) return override;
  return periods
    .map((period) => `${formatHistoricalYear(period.start)}—${formatHistoricalYear(period.end)}`)
    .join("、");
}
