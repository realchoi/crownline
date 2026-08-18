import { formatPeriods, isYearInPeriods } from "./chronology";
import { entityMatchesRegionScope, type RegionScope } from "./regionScope";
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
  const regionNames = entity.historicalRegionIds.flatMap((regionId) => {
    const region = data.regions.find(({ id }) => id === regionId);
    return region ? [region.names.primary, ...region.names.aliases, region.names.local ?? ""] : [];
  });
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
 * 按查询词和展示类别筛选实体。
 * 返回值保持时间轴阶段及阶段内部原有顺序，避免筛选后视觉位置跳动。
 */
export function filterEntities(
  data: BrowseData,
  query: string,
  category: CategoryFilter
): MatchedEntity[] {
  const normalizedQuery = normalizeText(query);
  const entityById = new Map(data.entities.map((entity) => [entity.id, entity]));
  const matches: MatchedEntity[] = [];

  data.timelineSections.forEach((section) => {
    section.entityIds.forEach((entityId) => {
      const entity = entityById.get(entityId);
      if (!entity) return;
      const categoryMatches = category === "all" || entity.displayCategory === category;
      const indexedText = searchableText(data, entity, section);
      if (categoryMatches && (!normalizedQuery || indexedText.includes(normalizedQuery))) {
        matches.push({ entity, section });
      }
    });
  });

  return matches;
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
  const scope = filters.regionScope ?? { mode: "china" };
  const regionMatches = data.entities.flatMap((entity): MatchedEntity[] => {
    const section = sectionByEntityId.get(entity.id);
    return entityMatchesRegionScope(entity, data.regions, scope) ? [{ entity, section }] : [];
  });
  const selectedYear = filters.year;
  const timeMatches =
    selectedYear === undefined
      ? regionMatches
      : regionMatches.filter(({ entity }) =>
          isYearInPeriods(selectedYear, entity.existencePeriods)
        );
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
        : selectedYear !== undefined && timePolities.length === 0
          ? "limited-coverage"
          : "filtered-out";

  return {
    all,
    polities,
    historicalPeriods: all.filter(({ entity }) => entity.entityKind === "historical-period"),
    polityEmptyReason
  };
}
