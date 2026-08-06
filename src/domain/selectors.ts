import { formatPeriods, isYearInPeriods } from "./chronology";
import type {
  CrownlineData,
  DisplayCategory,
  HistoricalEntity,
  TimelineSection
} from "./types";

/** 页面类别筛选值；`all` 表示不限制展示类别。 */
export type CategoryFilter = DisplayCategory | "all";

/** 筛选命中的实体及其所属时间轴阶段。 */
export interface MatchedEntity {
  entity: HistoricalEntity;
  section: TimelineSection;
}

export interface EntityFilters {
  query: string;
  category: CategoryFilter;
  year?: number;
}

export interface BrowseResults {
  all: MatchedEntity[];
  polities: MatchedEntity[];
  historicalPeriods: MatchedEntity[];
}

/** 统一搜索大小写、空白和常见中英文标点。 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s·•（）()—–－_,，。；;：:、]/g, "");
}

/**
 * 按查询词和展示类别筛选实体。
 * 返回值保持时间轴阶段及阶段内部原有顺序，避免筛选后视觉位置跳动。
 */
export function filterEntities(
  data: CrownlineData,
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
      const searchableText = normalizeText(
        [
          entity.names.primary,
          ...entity.names.aliases,
          formatPeriods(entity.existencePeriods, entity.displayRangeOverride),
          entity.description,
          section.title
        ].join(" ")
      );
      if (categoryMatches && (!normalizedQuery || searchableText.includes(normalizedQuery))) {
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
export function selectBrowseResults(
  data: CrownlineData,
  filters: EntityFilters
): BrowseResults {
  const filtered = filterEntities(data, filters.query, filters.category);
  const selectedYear = filters.year;
  const all = selectedYear === undefined
    ? filtered
    : filtered.filter(({ entity }) => isYearInPeriods(selectedYear, entity.existencePeriods));

  return {
    all,
    polities: all.filter(({ entity }) => entity.entityKind === "polity"),
    historicalPeriods: all.filter(({ entity }) => entity.entityKind === "historical-period")
  };
}
