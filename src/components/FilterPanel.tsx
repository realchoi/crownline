import { useId, useState, type Ref } from "react";

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
  /** `toolbar` 为桌面首屏的一行工具条加“更多筛选”；`full` 为筛选抽屉中的完整控件。 */
  layout?: "full" | "toolbar";
  viewMode: ViewMode;
  mapLayer: MapLayer;
  timeRange: TimeRange;
  year: number;
  yearBounds: HistoricalYearBounds;
  query: string;
  category: CategoryFilter;
  regions: Region[];
  regionScope: RegionScope;
  boundarySnapshotCount: number;
  onViewModeChange: (viewMode: ViewMode) => void;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  onYearChange: (year: number) => void;
  onMapLayerChange: (layer: MapLayer) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onRegionScopeChange: (scope: RegionScope) => void;
  onClear: () => void;
}

/** 渲染呈现方式、时间、地区、搜索、类别与图例控件。 */
export function FilterPanel({
  panelRef,
  layout = "full",
  viewMode,
  mapLayer,
  timeRange,
  year,
  yearBounds,
  query,
  category,
  regions,
  regionScope,
  boundarySnapshotCount,
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
  const hasBoundaries = boundarySnapshotCount > 0;
  const [moreOpen, setMoreOpen] = useState(regionScope.mode === "custom");
  const moreId = useId();

  const mapLayerControl = isMap && hasBoundaries && (
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
  );
  const searchField = (labelClassName: string) => (
    <label className="search-field">
      <span className={labelClassName}>搜索名称、别名、年份或说明</span>
      <input
        className="text-input"
        type="search"
        placeholder="例如：唐、奥斯曼、前221"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
    </label>
  );
  const categoryField = (
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
  );
  const clearButton = (
    <button
      className="button"
      type="button"
      aria-label="清除搜索与类别（控制台）"
      disabled={!hasFilters}
      onClick={onClear}
    >
      清除搜索与类别
    </button>
  );
  const legend = !isMap && timeRange === "all" && (
    <div className="legend" aria-label="类别图例">
      {Object.entries(DISPLAY_CATEGORY_NAMES).map(([value, label]) => (
        <span className={`legend-item legend-${value}`} key={value}>
          <i className="legend-mark" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );

  if (layout === "toolbar") {
    const hiddenFilterCount = category !== "all" ? 1 : 0;
    return (
      <section
        ref={panelRef}
        className={`controls-panel console-toolbar controls-${timeRange}${isMap ? " controls-map" : ""}`}
        aria-label="浏览与筛选工具"
        tabIndex={-1}
      >
        <h2 className="visually-hidden">探索控制台</h2>
        <div className="console-toolbar-row">
          <ViewModeControl value={viewMode} onChange={onViewModeChange} />
          <TimeRangeControl
            value={timeRange}
            year={year}
            yearBounds={yearBounds}
            onChange={onTimeRangeChange}
            onYearChange={onYearChange}
          />
          <RegionScopeControl
            part="presets"
            regions={regions}
            scope={regionScope}
            onChange={(scope) => {
              if (scope.mode === "custom") setMoreOpen(true);
              onRegionScopeChange(scope);
            }}
          />
          {/* 搜索框与“更多筛选”作为一个整体换行，避免按钮单独落到下一行。 */}
          <div className="console-toolbar-search">
            {searchField("visually-hidden")}
            <button
              className="console-more-toggle"
              type="button"
              aria-expanded={moreOpen}
              aria-controls={moreId}
              {...(hiddenFilterCount > 0
                ? { "aria-label": `更多筛选，已启用 ${hiddenFilterCount} 项` }
                : {})}
              onClick={() => setMoreOpen((open) => !open)}
            >
              更多筛选
              {hiddenFilterCount > 0 && (
                <span className="console-more-count" aria-hidden="true">
                  {hiddenFilterCount}
                </span>
              )}
              <span className="console-more-chevron" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div id={moreId} className="console-more" hidden={!moreOpen}>
          <RegionScopeControl
            part="details"
            regions={regions}
            scope={regionScope}
            onChange={onRegionScopeChange}
          />
          {mapLayerControl}
          <div className="console-more-filters">
            {categoryField}
            {clearButton}
          </div>
          {legend}
        </div>
      </section>
    );
  }

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

      {mapLayerControl}

      <div className="controls-grid">
        {searchField("field-label")}
        {categoryField}
        {clearButton}
      </div>
      {legend}
    </section>
  );
}
