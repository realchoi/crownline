import { useId, useState, type Ref } from "react";

import type { HistoricalYearBounds, MapLayer, TimeRange, ViewMode } from "../domain/browseState";
import type { RegionScope } from "../domain/regionScope";
import type { CategoryFilter } from "../domain/selectors";
import type { Region } from "../domain/types";
import { CategoryFilterControl } from "./CategoryFilterControl";
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
  onRegionScopeChange
}: FilterPanelProps) {
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
  const categoryControl = (
    <CategoryFilterControl value={category} showSwatches={!isMap} onChange={onCategoryChange} />
  );

  if (layout === "toolbar") {
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
              onClick={() => setMoreOpen((open) => !open)}
            >
              更多筛选
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
        </div>
        {categoryControl}
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

      <div className="controls-grid">{searchField("field-label")}</div>
      {categoryControl}
    </section>
  );
}
