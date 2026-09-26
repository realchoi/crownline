import type { Ref } from "react";

import type { HistoricalYearBounds, TimeRange, ViewMode } from "../domain/browseState";
import type { RegionScope } from "../domain/regionScope";
import type { CategoryFilter } from "../domain/selectors";
import type { Region } from "../domain/types";
import { CategoryFilterControl } from "./CategoryFilterControl";
import { RegionScopeControl } from "./RegionScopeControl";
import { RegionScopePopover } from "./RegionScopePopover";
import { TimeRangeControl } from "./TimeRangeControl";
import { ViewModeControl } from "./ViewModeControl";

/** 筛选面板的受控状态与事件。 */
export interface FilterPanelProps {
  panelRef?: Ref<HTMLElement>;
  /** `toolbar` 为桌面首屏的三层控制台；`full` 为筛选抽屉中的纵向控件。 */
  layout?: "full" | "toolbar";
  viewMode: ViewMode;
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
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onRegionScopeChange: (scope: RegionScope) => void;
}

/**
 * 控制台按“怎么看 → 何时 → 看什么”分层：呈现方式页签与观测范围、搜索同排，
 * 时间独占一行全宽刻度尺，类别筛选兼作图例。
 */
export function FilterPanel({
  panelRef,
  layout = "full",
  viewMode,
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
  onQueryChange,
  onCategoryChange,
  onRegionScopeChange
}: FilterPanelProps) {
  const isMap = viewMode === "map";

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
  const timeControl = (
    <TimeRangeControl
      value={timeRange}
      year={year}
      yearBounds={yearBounds}
      onChange={onTimeRangeChange}
      onYearChange={onYearChange}
    />
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
          <ViewModeControl value={viewMode} onChange={onViewModeChange} appearance="tabs" />
          <div className="console-toolbar-filters">
            <RegionScopePopover
              regions={regions}
              scope={regionScope}
              onChange={onRegionScopeChange}
            />
            {searchField("visually-hidden")}
          </div>
        </div>
        {timeControl}
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
      {timeControl}
      <RegionScopeControl regions={regions} scope={regionScope} onChange={onRegionScopeChange} />
      <div className="controls-grid">{searchField("field-label")}</div>
      {categoryControl}
    </section>
  );
}
