import { DISPLAY_CATEGORY_NAMES } from "../domain/displayCategories";
import { getRegionsByIds, type RegionScope } from "../domain/regionScope";
import type { CategoryFilter } from "../domain/selectors";
import { formatTimeWindow, type TimeWindow } from "../domain/timeWindow";
import type { Region } from "../domain/types";

interface ActiveFilterChipsProps {
  query: string;
  category: CategoryFilter;
  regionScope: RegionScope;
  regions: Region[];
  /** 生效中的时间窗口；它属于探索上下文，只能单独移除，不随“清除搜索与类别”清空。 */
  timeWindow: TimeWindow | null;
  onTimeWindowChange: (window: TimeWindow | null) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onRegionScopeChange: (scope: RegionScope) => void;
  onClearAdditional: () => void;
}

/** 紧凑展示附加筛选，并允许逐项移除；空状态不渲染占位容器。 */
export function ActiveFilterChips({
  query,
  category,
  regionScope,
  regions,
  timeWindow,
  onTimeWindowChange,
  onQueryChange,
  onCategoryChange,
  onRegionScopeChange,
  onClearAdditional
}: ActiveFilterChipsProps) {
  const trimmedQuery = query.trim();
  const customRegions =
    regionScope.mode === "custom" ? getRegionsByIds(regions, regionScope.regionIds) : [];
  const hasAdditionalFilters = trimmedQuery.length > 0 || category !== "all";
  const hasActiveFilters = hasAdditionalFilters || customRegions.length > 0 || timeWindow !== null;

  if (!hasActiveFilters) return null;

  const removeRegion = (regionId: string) => {
    if (regionScope.mode !== "custom") return;
    const nextIds = regionScope.regionIds.filter((id) => id !== regionId);
    onRegionScopeChange(
      nextIds.length > 0 ? { mode: "custom", regionIds: nextIds } : { mode: "global" }
    );
  };

  return (
    <div className="active-filter-bar" aria-label="活跃筛选">
      <span className="active-filter-label">已选</span>
      <div className="active-filter-list">
        {timeWindow && (
          <span className="filter-chip filter-chip-window">
            <span>时段：{formatTimeWindow(timeWindow)}</span>
            <button
              type="button"
              aria-label={`移除时段：${formatTimeWindow(timeWindow)}`}
              onClick={() => onTimeWindowChange(null)}
            >
              ×
            </button>
          </span>
        )}
        {trimmedQuery && (
          <span className="filter-chip">
            <span>搜索：{trimmedQuery}</span>
            <button
              type="button"
              aria-label={`移除搜索：${trimmedQuery}`}
              onClick={() => onQueryChange("")}
            >
              ×
            </button>
          </span>
        )}
        {category !== "all" && (
          <span className="filter-chip">
            <span>类别：{DISPLAY_CATEGORY_NAMES[category]}</span>
            <button
              type="button"
              aria-label={`移除类别：${DISPLAY_CATEGORY_NAMES[category]}`}
              onClick={() => onCategoryChange("all")}
            >
              ×
            </button>
          </span>
        )}
        {customRegions.map((region) => (
          <span className="filter-chip filter-chip-region" key={region.id}>
            <span>地区：{region.names.primary}</span>
            <button
              type="button"
              aria-label={`移除地区：${region.names.primary}`}
              onClick={() => removeRegion(region.id)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {hasAdditionalFilters && (
        <button className="clear-additional-button" type="button" onClick={onClearAdditional}>
          清除搜索与类别
        </button>
      )}
    </div>
  );
}
