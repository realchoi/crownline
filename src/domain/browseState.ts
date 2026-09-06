import type { RegionScope } from "./regionScope";
import type { BrowseData, DisplayCategory, HistoricalEntity, Region } from "./types";
import type { CategoryFilter } from "./selectors";

/** 用户选择的时间范围；URL 继续使用旧的 mode=point 契约。 */
export type TimeRange = "all" | "year";
export type ViewMode = "timeline" | "map";
export type MapLayer = "points" | "boundaries" | "combined";

export interface HistoricalYearBounds {
  min: number;
  max: number;
}

export interface BrowseState {
  viewMode: ViewMode;
  mapLayer: MapLayer;
  timeRange: TimeRange;
  /** 最近一次浏览的有效年份；全时期状态下仅保留，不参与结果筛选。 */
  year: number;
  query: string;
  category: CategoryFilter;
  regionScope: RegionScope;
  compareEntityIds: string[];
  detailEntityId: string | null;
  comparisonOpen: boolean;
}

/** 选择年份始终进入指定年份状态；其他浏览维度保持不变。 */
export function selectBrowseYear(state: BrowseState, year: number): BrowseState {
  return { ...state, timeRange: "year", year };
}

/** 返回全时期时保留最近浏览年份，供再次进入指定年份使用。 */
export function selectTimeRange(state: BrowseState, timeRange: TimeRange): BrowseState {
  return { ...state, timeRange };
}

/** “清除筛选”只负责搜索和类别，不重置探索上下文。 */
export function clearAdditionalFilters(state: BrowseState): BrowseState {
  return { ...state, query: "", category: "all" };
}

const VALID_CATEGORIES = new Set<CategoryFilter>([
  "all",
  "mainline",
  "contemporary",
  "regional",
  "context"
]);

const LEGACY_CATEGORY_MAP: Record<string, DisplayCategory> = {
  main: "mainline",
  parallel: "contemporary",
  period: "context",
  regional: "regional"
};

/** 从已加载实体的全部存在区间推导年份控件边界。 */
export function getHistoricalYearBounds(data: Pick<BrowseData, "entities">): HistoricalYearBounds {
  const years = data.entities.flatMap((entity) => {
    return entity.existencePeriods.flatMap((period) => [period.start.year, period.end.year]);
  });
  if (years.length === 0) throw new Error("历史数据中没有可用的存在区间");
  return { min: Math.min(...years), max: Math.max(...years) };
}

/** 从 URL 读取并清洗阶段 1 的共享浏览状态。 */
export function readBrowseState(
  search: string,
  bounds: HistoricalYearBounds,
  regions: Region[] = [],
  entities: HistoricalEntity[] = []
): BrowseState {
  const params = new URLSearchParams(search);
  const rawYear = Number(params.get("year"));
  const year =
    Number.isSafeInteger(rawYear) && rawYear !== 0
      ? Math.min(bounds.max, Math.max(bounds.min, rawYear))
      : bounds.max;
  const rawCategory = params.get("type") ?? "all";
  const mappedCategory = LEGACY_CATEGORY_MAP[rawCategory] ?? rawCategory;
  const viewMode: ViewMode = params.get("view") === "map" ? "map" : "timeline";
  const rawLayer = params.get("layer");
  const mapLayer: MapLayer =
    rawLayer === "boundaries" || rawLayer === "combined" ? rawLayer : "points";
  const hasExplicitYear = params.has("year") && Number.isSafeInteger(rawYear) && rawYear !== 0;
  const rawMode = params.get("mode");
  const timeRange: TimeRange =
    rawMode === "point" || (rawMode !== "overview" && viewMode === "map" && hasExplicitYear)
      ? "year"
      : "all";
  const rawScope = params.get("scope");
  const validHistoricalRegionIds = new Set(
    regions.filter(({ regionKind }) => regionKind === "historical-region").map(({ id }) => id)
  );
  const customRegionIds = [...new Set(params.getAll("region"))]
    .filter((id) => validHistoricalRegionIds.has(id))
    .sort();
  const regionScope: RegionScope =
    rawScope === "china"
      ? { mode: "china" }
      : rawScope === "custom" && customRegionIds.length > 0
        ? { mode: "custom", regionIds: customRegionIds }
        : { mode: "global" };
  const polityIds = new Set(
    entities.filter(({ entityKind }) => entityKind === "polity").map(({ id }) => id)
  );
  const compareEntityIds = [...new Set(params.getAll("compare"))]
    .filter((id) => polityIds.has(id))
    .slice(0, 2);
  const entityIds = new Set(entities.map(({ id }) => id));
  const rawDetail = params.get("detail");
  const detailEntityId = rawDetail && entityIds.has(rawDetail) ? rawDetail : null;

  return {
    viewMode,
    mapLayer,
    timeRange,
    year,
    query: params.get("q") ?? "",
    category: VALID_CATEGORIES.has(mappedCategory as CategoryFilter)
      ? (mappedCategory as CategoryFilter)
      : "all",
    regionScope,
    compareEntityIds,
    detailEntityId,
    comparisonOpen:
      params.get("comparison") === "open" && compareEntityIds.length > 0 && !detailEntityId
  };
}

/** 将共享浏览状态写入查询参数，同时保留调用方不认识的参数。 */
export function writeBrowseState(
  state: BrowseState,
  bounds: HistoricalYearBounds,
  currentSearch = ""
): URLSearchParams {
  const params = new URLSearchParams(currentSearch);
  [
    "view",
    "mode",
    "year",
    "q",
    "type",
    "scope",
    "region",
    "compare",
    "detail",
    "layer",
    "comparison"
  ].forEach((name) => params.delete(name));

  if (state.viewMode === "map") params.set("view", "map");
  if (state.viewMode === "map" && state.mapLayer !== "points") {
    params.set("layer", state.mapLayer);
  }
  if (state.timeRange === "year") params.set("mode", "point");
  if (state.timeRange === "year" && state.year !== bounds.max) {
    params.set("year", String(state.year));
  }
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.category !== "all") params.set("type", state.category);
  if (state.regionScope.mode === "china") params.set("scope", "china");
  if (state.regionScope.mode === "custom") {
    params.set("scope", "custom");
    [...new Set(state.regionScope.regionIds)].sort().forEach((regionId) => {
      params.append("region", regionId);
    });
  }
  [...new Set(state.compareEntityIds)].slice(0, 2).forEach((entityId) => {
    params.append("compare", entityId);
  });
  if (state.detailEntityId) params.set("detail", state.detailEntityId);
  if (state.comparisonOpen && state.compareEntityIds.length > 0 && !state.detailEntityId) {
    params.set("comparison", "open");
  }
  return params;
}
