import type { CrownlineData, DisplayCategory } from "./types";
import type { CategoryFilter } from "./selectors";

export type BrowseMode = "overview" | "point";

export interface HistoricalYearBounds {
  min: number;
  max: number;
}

export interface BrowseState {
  mode: BrowseMode;
  year: number;
  query: string;
  category: CategoryFilter;
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
export function getHistoricalYearBounds(data: CrownlineData): HistoricalYearBounds {
  const years = data.entities.flatMap((entity) => {
    return entity.existencePeriods.flatMap((period) => [period.start.year, period.end.year]);
  });
  if (years.length === 0) throw new Error("历史数据中没有可用的存在区间");
  return { min: Math.min(...years), max: Math.max(...years) };
}

/** 从 URL 读取并清洗阶段 1 的共享浏览状态。 */
export function readBrowseState(
  search: string,
  bounds: HistoricalYearBounds
): BrowseState {
  const params = new URLSearchParams(search);
  const rawYear = Number(params.get("year"));
  const year = Number.isSafeInteger(rawYear) && rawYear !== 0
    ? Math.min(bounds.max, Math.max(bounds.min, rawYear))
    : bounds.max;
  const rawCategory = params.get("type") ?? "all";
  const mappedCategory = LEGACY_CATEGORY_MAP[rawCategory] ?? rawCategory;

  return {
    mode: params.get("mode") === "point" ? "point" : "overview",
    year,
    query: params.get("q") ?? "",
    category: VALID_CATEGORIES.has(mappedCategory as CategoryFilter)
      ? (mappedCategory as CategoryFilter)
      : "all"
  };
}

/** 将共享浏览状态写入查询参数，同时保留调用方不认识的参数。 */
export function writeBrowseState(
  state: BrowseState,
  bounds: HistoricalYearBounds,
  currentSearch = ""
): URLSearchParams {
  const params = new URLSearchParams(currentSearch);
  ["mode", "year", "q", "type"].forEach((name) => params.delete(name));

  if (state.mode === "point") params.set("mode", "point");
  if (state.year !== bounds.max) params.set("year", String(state.year));
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.category !== "all") params.set("type", state.category);
  return params;
}
