import { DISPLAY_CATEGORY_NAMES } from "../domain/displayCategories";
import type { RegionScope } from "../domain/regionScope";
import type { CategoryFilter } from "../domain/selectors";
import type { Region } from "../domain/types";

interface ActiveFilterChipsProps {
  query: string;
  category: CategoryFilter;
  regionScope: RegionScope;
  regions: Region[];
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
  onQueryChange,
  onCategoryChange,
  onRegionScopeChange,
  onClearAdditional
}: ActiveFilterChipsProps) {
  const trimmedQuery = query.trim();
  const customRegions =
    regionScope.mode === "custom"
      ? regionScope.regionIds.flatMap((regionId) => {
          const region = regions.find(({ id }) => id === regionId);
          return region ? [region] : [];
        })
      : [];
  const hasAdditionalFilters = trimmedQuery.length > 0 || category !== "all";
  const hasActiveFilters = hasAdditionalFilters || customRegions.length > 0;

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
