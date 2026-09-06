import type { Ref } from "react";

import type { HistoricalYearBounds, MapLayer, TimeRange, ViewMode } from "../domain/browseState";
import { DISPLAY_CATEGORY_NAMES } from "../domain/displayCategories";
import type { RegionScope } from "../domain/regionScope";
import type { CategoryFilter } from "../domain/selectors";
import type { Region } from "../domain/types";
import { RegionScopeControl } from "./RegionScopeControl";
import { TimeRangeControl } from "./TimeRangeControl";
import { ViewModeControl } from "./ViewModeControl";

/** 筛选面板的受控状态与事件。 */
export interface FilterPanelProps {
  panelRef?: Ref<HTMLElement>;
  viewMode: ViewMode;
  mapLayer: MapLayer;
  timeRange: TimeRange;
  year: number;
  yearBounds: HistoricalYearBounds;
  query: string;
  category: CategoryFilter;
  regions: Region[];
  regionScope: RegionScope;
  onViewModeChange: (viewMode: ViewMode) => void;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  onYearChange: (year: number) => void;
  onMapLayerChange: (layer: MapLayer) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onRegionScopeChange: (scope: RegionScope) => void;
  onClear: () => void;
}

/** 渲染搜索、类别筛选、清除按钮和类别图例。 */
export function FilterPanel({
  panelRef,
  viewMode,
  mapLayer,
  timeRange,
  year,
  yearBounds,
  query,
  category,
  regions,
  regionScope,
  onViewModeChange,
  onTimeRangeChange,
  onYearChange,
  onMapLayerChange,
  onQueryChange,
  onCategoryChange,
  onRegionScopeChange,
  onClear
}: FilterPanelProps) {
  const hasFilters = query.trim().length > 0 || category !== "all";
  const showPoints = mapLayer !== "boundaries";
  const showBoundaries = mapLayer !== "points";
  const isMap = viewMode === "map";

  return (
    <section
      ref={panelRef}
      className={`controls-panel controls-${timeRange}${isMap ? " controls-map" : ""}`}
      aria-label="浏览与筛选工具"
      tabIndex={-1}
    >
      <header className="controls-panel-heading">
        <h2>探索控制台</h2>
        <ViewModeControl value={viewMode} onChange={onViewModeChange} />
      </header>
      <TimeRangeControl
        value={timeRange}
        year={year}
        yearBounds={yearBounds}
        onChange={onTimeRangeChange}
        onYearChange={onYearChange}
      />

      <RegionScopeControl regions={regions} scope={regionScope} onChange={onRegionScopeChange} />

      {isMap && (
        <fieldset className="map-layer-control">
          <legend className="field-label">地图图层</legend>
          <div className="map-layer-switch" role="group" aria-label="地图图层">
            <button
              type="button"
              aria-pressed={showPoints}
              onClick={() => {
                if (mapLayer === "combined") onMapLayerChange("boundaries");
                else if (mapLayer === "boundaries") onMapLayerChange("combined");
              }}
            >
              地点标记
            </button>
            <button
              type="button"
              aria-pressed={showBoundaries}
              onClick={() => {
                if (mapLayer === "combined") onMapLayerChange("points");
                else if (mapLayer === "points") onMapLayerChange("combined");
              }}
            >
              疆域示意
            </button>
          </div>
          <p className="map-layer-help">
            默认显示地点标记；开启疆域示意后两者叠加。疆域需要明确年份，且不代表精确勘界。
          </p>
        </fieldset>
      )}

      <div className="controls-grid">
        <label>
          <span className="field-label">搜索名称、别名、年份或说明</span>
          <input
            className="text-input"
            type="search"
            placeholder="例如：唐、北魏、南宋、前221"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className="field-label">显示类别</span>
          <select
            className="select-input"
            value={category}
            onChange={(event) => onCategoryChange(event.currentTarget.value as CategoryFilter)}
          >
            <option value="all">全部条目</option>
            {Object.entries(DISPLAY_CATEGORY_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          type="button"
          aria-label="清除搜索与类别（控制台）"
          disabled={!hasFilters}
          onClick={onClear}
        >
          清除搜索与类别
        </button>
      </div>
      {!isMap && timeRange === "all" && (
        <div className="legend" aria-label="类别图例">
          {Object.entries(DISPLAY_CATEGORY_NAMES).map(([value, label]) => (
            <span className={`legend-item legend-${value}`} key={value}>
              <i className="legend-mark" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
