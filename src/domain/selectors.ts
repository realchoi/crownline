import { formatPeriods, isYearInPeriods } from "./chronology";
import { createRegionScopeMatcher, getRegionsByIds, type RegionScope } from "./regionScope";
import { isPeriodInTimeWindow, type TimeWindow } from "./timeWindow";
import type { BrowseData, DisplayCategory, HistoricalEntity, TimelineSection } from "./types";

/** 页面类别筛选值；`all` 表示不限制展示类别。 */
export type CategoryFilter = DisplayCategory | "all";

/** 筛选命中的实体及其所属时间轴阶段。 */
export interface MatchedEntity {
  entity: HistoricalEntity;
  section: TimelineSection | undefined;
}

export interface EntityFilters {
  query: string;
  category: CategoryFilter;
  year?: number;
  /** 全览时间轴的放大窗口；保留至少一段存在区间与窗口重叠的条目。 */
  timeWindow?: TimeWindow;
  regionScope?: RegionScope;
}

export interface BrowseResults {
  all: MatchedEntity[];
  polities: MatchedEntity[];
  historicalPeriods: MatchedEntity[];
  polityEmptyReason: "unindexed" | "limited-coverage" | "filtered-out" | null;
}

function searchableText(
  data: BrowseData,
  entity: HistoricalEntity,
  section?: TimelineSection
): string {
  const regionNames = getRegionsByIds(data.regions, entity.historicalRegionIds).flatMap(
    ({ names }) => [names.primary, ...names.aliases, names.local ?? ""]
  );
  return normalizeText(
    [
      entity.names.primary,
      ...entity.names.aliases,
      entity.names.local ?? "",
      ...regionNames,
      formatPeriods(entity.existencePeriods, entity.displayRangeOverride),
      entity.description,
      section?.title ?? ""
    ].join(" ")
  );
}

/** 统一搜索大小写、空白和常见中英文标点。 */
function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[\s·•（）()—–－_,，。；;：:、]/g, "");
}

/**
 * 组合搜索、类别和可选年份筛选，并将真实政权与历史分期明确分区。
 * 未提供年份时保持全览模式的原有结果。
 */
export function selectBrowseResults(data: BrowseData, filters: EntityFilters): BrowseResults {
  const normalizedQuery = normalizeText(filters.query);
  const sectionByEntityId = new Map<string, TimelineSection>();
  data.timelineSections.forEach((section) => {
    section.entityIds.forEach((entityId) => sectionByEntityId.set(entityId, section));
  });
  const matchesScope = createRegionScopeMatcher(
    data.regions,
    filters.regionScope ?? { mode: "china" }
  );
  const regionMatches = data.entities.flatMap((entity): MatchedEntity[] => {
    return matchesScope(entity) ? [{ entity, section: sectionByEntityId.get(entity.id) }] : [];
  });
  const selectedYear = filters.year;
  const timeWindow = filters.timeWindow;
  const timeMatches = regionMatches.filter(({ entity }) => {
    if (selectedYear !== undefined && !isYearInPeriods(selectedYear, entity.existencePeriods)) {
      return false;
    }
    return (
      timeWindow === undefined ||
      entity.existencePeriods.some((period) => isPeriodInTimeWindow(period, timeWindow))
    );
  });
  const all = timeMatches.filter(({ entity, section }) => {
    const categoryMatches =
      filters.category === "all" || entity.displayCategory === filters.category;
    const queryMatches =
      !normalizedQuery || searchableText(data, entity, section).includes(normalizedQuery);
    return categoryMatches && queryMatches;
  });
  const polities = all.filter(({ entity }) => entity.entityKind === "polity");
  const regionPolities = regionMatches.filter(({ entity }) => entity.entityKind === "polity");
  const timePolities = timeMatches.filter(({ entity }) => entity.entityKind === "polity");
  const polityEmptyReason =
    polities.length > 0
      ? null
      : regionPolities.length === 0
        ? "unindexed"
        : (selectedYear !== undefined || timeWindow !== undefined) && timePolities.length === 0
          ? "limited-coverage"
          : "filtered-out";

  return {
    all,
    polities,
    historicalPeriods: all.filter(({ entity }) => entity.entityKind === "historical-period"),
    polityEmptyReason
  };
}
