import { fromOrdinal, toOrdinal } from "./chronology";
import type {
  GeographicSnapshot,
  HistoricalEntity,
  HistoricalInterval,
  Reign,
  ReignVacancy
} from "./types";

/** 工具侧覆盖分析使用的闭区间；年份遵循无公元 0 年规则。 */
export interface HistoricalYearRange {
  startYear: number;
  endYear: number;
}

export interface RulerTemporalCoverage {
  rulerPeriods: HistoricalYearRange[];
  explicitVacancyPeriods: HistoricalYearRange[];
  regencyPeriods: HistoricalYearRange[];
  claimantPeriods: HistoricalYearRange[];
  anyReignPeriods: HistoricalYearRange[];
  unknownPeriods: HistoricalYearRange[];
  rulerCoveredYears: number;
  explicitVacancyYears: number;
  regencyYears: number;
  claimantYears: number;
  anyReignYears: number;
  documentedYears: number;
  unknownYears: number;
  rulerCoveragePercentage: number;
  documentedPercentage: number;
}

export interface GeographyTemporalCoverage {
  coveredPeriods: HistoricalYearRange[];
  unknownPeriods: HistoricalYearRange[];
  coveredYears: number;
  unknownYears: number;
  coveredPercentage: number;
}

export interface PolityTemporalCoverage {
  entityId: string;
  name: string;
  existencePeriods: HistoricalYearRange[];
  totalExistenceYears: number;
  rulerDetails: RulerTemporalCoverage;
  geography: GeographyTemporalCoverage;
}

function percentage(covered: number, total: number): number {
  return total === 0 ? 0 : Number(((covered / total) * 100).toFixed(2));
}

function compareRanges(left: HistoricalYearRange, right: HistoricalYearRange): number {
  return (
    toOrdinal(left.startYear) - toOrdinal(right.startYear) ||
    toOrdinal(left.endYear) - toOrdinal(right.endYear)
  );
}

function intervalToRange(interval: HistoricalInterval): HistoricalYearRange {
  return { startYear: interval.start.year, endYear: interval.end.year };
}

/**
 * 合并重叠或相邻的历史年份闭区间。输出按时间排序，输入顺序不影响结果。
 * 公元前 1 年与公元 1 年在历史序数上相邻，因此也会正确合并。
 */
export function normalizeHistoricalYearRanges(
  ranges: readonly HistoricalYearRange[]
): HistoricalYearRange[] {
  const sorted = ranges.map((range) => {
    const startOrdinal = toOrdinal(range.startYear);
    const endOrdinal = toOrdinal(range.endYear);
    if (startOrdinal > endOrdinal) throw new Error("历史年份区间起点不得晚于终点");
    return { ...range };
  });
  sorted.sort(compareRanges);

  const normalized: HistoricalYearRange[] = [];
  sorted.forEach((range) => {
    const previous = normalized.at(-1);
    if (!previous || toOrdinal(range.startYear) > toOrdinal(previous.endYear) + 1) {
      normalized.push(range);
      return;
    }
    if (toOrdinal(range.endYear) > toOrdinal(previous.endYear)) {
      previous.endYear = range.endYear;
    }
  });
  return normalized;
}

/** 返回若干区间落在基准区间内的交集，并做稳定合并。 */
export function intersectHistoricalYearRanges(
  ranges: readonly HistoricalYearRange[],
  bounds: readonly HistoricalYearRange[]
): HistoricalYearRange[] {
  const normalizedRanges = normalizeHistoricalYearRanges(ranges);
  const normalizedBounds = normalizeHistoricalYearRanges(bounds);
  const intersections: HistoricalYearRange[] = [];

  normalizedRanges.forEach((range) => {
    normalizedBounds.forEach((bound) => {
      const startOrdinal = Math.max(toOrdinal(range.startYear), toOrdinal(bound.startYear));
      const endOrdinal = Math.min(toOrdinal(range.endYear), toOrdinal(bound.endYear));
      if (startOrdinal <= endOrdinal) {
        intersections.push({
          startYear: fromOrdinal(startOrdinal),
          endYear: fromOrdinal(endOrdinal)
        });
      }
    });
  });
  return normalizeHistoricalYearRanges(intersections);
}

/** 从基准闭区间中扣除已覆盖区间，得到仍未知的年份区间。 */
export function subtractHistoricalYearRanges(
  base: readonly HistoricalYearRange[],
  excluded: readonly HistoricalYearRange[]
): HistoricalYearRange[] {
  const normalizedBase = normalizeHistoricalYearRanges(base);
  const normalizedExcluded = normalizeHistoricalYearRanges(excluded);
  const remaining: HistoricalYearRange[] = [];

  normalizedBase.forEach((baseRange) => {
    let cursor = toOrdinal(baseRange.startYear);
    const baseEnd = toOrdinal(baseRange.endYear);
    normalizedExcluded.forEach((excludedRange) => {
      const excludedStart = toOrdinal(excludedRange.startYear);
      const excludedEnd = toOrdinal(excludedRange.endYear);
      if (excludedEnd < cursor || excludedStart > baseEnd) return;
      if (excludedStart > cursor) {
        remaining.push({
          startYear: fromOrdinal(cursor),
          endYear: fromOrdinal(Math.min(baseEnd, excludedStart - 1))
        });
      }
      cursor = Math.max(cursor, excludedEnd + 1);
    });
    if (cursor <= baseEnd) {
      remaining.push({ startYear: fromOrdinal(cursor), endYear: fromOrdinal(baseEnd) });
    }
  });
  return remaining;
}

/** 计算闭区间覆盖的历史年份数；重叠和相邻区间只计算一次。 */
export function countHistoricalYears(ranges: readonly HistoricalYearRange[]): number {
  return normalizeHistoricalYearRanges(ranges).reduce((total, range) => {
    return total + toOrdinal(range.endYear) - toOrdinal(range.startYear) + 1;
  }, 0);
}

function scopedPeriods(
  periods: readonly HistoricalInterval[],
  existencePeriods: readonly HistoricalYearRange[]
): HistoricalYearRange[] {
  return intersectHistoricalYearRanges(periods.map(intervalToRange), existencePeriods);
}

/**
 * 分析单一政权的逐年资料覆盖。摄政和争位记录不作为正式统治者任期资料；
 * 只有 ruler/co-ruler 任期和有来源的明确空位会从正式统治者资料未知区间中扣除。
 */
export function buildPolityTemporalCoverage(
  polity: HistoricalEntity,
  reigns: readonly Reign[],
  reignVacancies: readonly ReignVacancy[],
  geographicSnapshots: readonly GeographicSnapshot[]
): PolityTemporalCoverage {
  const existencePeriods = normalizeHistoricalYearRanges(
    polity.existencePeriods.map(intervalToRange)
  );
  const scopedReigns = reigns.filter(({ polityId }) => polityId === polity.id);
  const rulerPeriods = scopedPeriods(
    scopedReigns
      .filter(({ role }) => role === "ruler" || role === "co-ruler")
      .flatMap(({ periods }) => periods),
    existencePeriods
  );
  const regencyPeriods = scopedPeriods(
    scopedReigns.filter(({ role }) => role === "regent").flatMap(({ periods }) => periods),
    existencePeriods
  );
  const claimantPeriods = scopedPeriods(
    scopedReigns.filter(({ role }) => role === "contender").flatMap(({ periods }) => periods),
    existencePeriods
  );
  const anyReignPeriods = scopedPeriods(
    scopedReigns.flatMap(({ periods }) => periods),
    existencePeriods
  );
  const explicitVacancyPeriods = scopedPeriods(
    reignVacancies
      .filter(({ polityId }) => polityId === polity.id)
      .flatMap(({ periods }) => periods),
    existencePeriods
  );
  const documentedPeriods = normalizeHistoricalYearRanges([
    ...rulerPeriods,
    ...explicitVacancyPeriods
  ]);
  const unknownRulerPeriods = subtractHistoricalYearRanges(existencePeriods, documentedPeriods);
  const geographyPeriods = scopedPeriods(
    geographicSnapshots
      .filter(({ polityId }) => polityId === polity.id)
      .flatMap(({ periods }) => periods),
    existencePeriods
  );
  const unknownGeographyPeriods = subtractHistoricalYearRanges(existencePeriods, geographyPeriods);
  const totalExistenceYears = countHistoricalYears(existencePeriods);
  const rulerCoveredYears = countHistoricalYears(rulerPeriods);
  const explicitVacancyYears = countHistoricalYears(explicitVacancyPeriods);
  const documentedYears = countHistoricalYears(documentedPeriods);
  const geographyCoveredYears = countHistoricalYears(geographyPeriods);

  return {
    entityId: polity.id,
    name: polity.names.primary,
    existencePeriods,
    totalExistenceYears,
    rulerDetails: {
      rulerPeriods,
      explicitVacancyPeriods,
      regencyPeriods,
      claimantPeriods,
      anyReignPeriods,
      unknownPeriods: unknownRulerPeriods,
      rulerCoveredYears,
      explicitVacancyYears,
      regencyYears: countHistoricalYears(regencyPeriods),
      claimantYears: countHistoricalYears(claimantPeriods),
      anyReignYears: countHistoricalYears(anyReignPeriods),
      documentedYears,
      unknownYears: countHistoricalYears(unknownRulerPeriods),
      rulerCoveragePercentage: percentage(rulerCoveredYears, totalExistenceYears),
      documentedPercentage: percentage(documentedYears, totalExistenceYears)
    },
    geography: {
      coveredPeriods: geographyPeriods,
      unknownPeriods: unknownGeographyPeriods,
      coveredYears: geographyCoveredYears,
      unknownYears: countHistoricalYears(unknownGeographyPeriods),
      coveredPercentage: percentage(geographyCoveredYears, totalExistenceYears)
    }
  };
}
