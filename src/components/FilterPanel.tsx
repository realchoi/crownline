import {
  formatHistoricalYear,
  fromOrdinal,
  nextHistoricalYear,
  previousHistoricalYear,
  toOrdinal
} from "../domain/chronology";
import type { BrowseMode, HistoricalYearBounds } from "../domain/browseState";
import type { RegionScope } from "../domain/regionScope";
import type { CategoryFilter } from "../domain/selectors";
import type { DisplayCategory, Region } from "../domain/types";
import { RegionScopeControl } from "./RegionScopeControl";

/** 展示类别对应的中文界面名称。 */
export const DISPLAY_CATEGORY_NAMES: Record<DisplayCategory, string> = {
  mainline: "主线王朝",
  contemporary: "主要并立政权",
  context: "历史分期",
  regional: "区域政权"
};

/** 筛选面板的受控状态与事件。 */
export interface FilterPanelProps {
  showModeSwitch: boolean;
  showYearControls: boolean;
  mode: BrowseMode;
  year: number;
  yearBounds: HistoricalYearBounds;
  query: string;
  category: CategoryFilter;
  regions: Region[];
  regionScope: RegionScope;
  onModeChange: (mode: BrowseMode) => void;
  onYearChange: (year: number) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onRegionScopeChange: (scope: RegionScope) => void;
  onClear: () => void;
}

/** 渲染搜索、类别筛选、清除按钮和类别图例。 */
export function FilterPanel({
  showModeSwitch,
  showYearControls,
  mode,
  year,
  yearBounds,
  query,
  category,
  regions,
  regionScope,
  onModeChange,
  onYearChange,
  onQueryChange,
  onCategoryChange,
  onRegionScopeChange,
  onClear
}: FilterPanelProps) {
  const hasFilters = query.trim().length > 0 || category !== "all";
  const formattedYear = formatHistoricalYear({ year, precision: "exact" });

  return (
    <section
      className={`controls-panel controls-${mode}${showModeSwitch ? "" : " controls-map"}`}
      aria-label="浏览与筛选工具"
    >
      {showModeSwitch && (
        <div className="browse-mode-row">
          <div>
            <span className="field-label">浏览方式</span>
            <div className="mode-switch" role="group" aria-label="浏览方式">
              <button
                type="button"
                aria-pressed={mode === "overview"}
                onClick={() => onModeChange("overview")}
              >
                全览
              </button>
              <button
                type="button"
                aria-pressed={mode === "point"}
                onClick={() => onModeChange("point")}
              >
                时间点
              </button>
            </div>
          </div>
        </div>
      )}

      <RegionScopeControl
        regions={regions}
        scope={regionScope}
        onChange={onRegionScopeChange}
      />

      <div className="controls-grid">
        {showYearControls && (
          <div className="year-panel">
            <div className="year-current">
              <span className="field-label">当前年份</span>
              <output aria-label="当前年份" aria-live="polite">
                {formattedYear}
              </output>
            </div>
            <div className="year-slider-row">
              <button
                className="year-step-button"
                type="button"
                aria-label="上一年"
                disabled={year === yearBounds.min}
                onClick={() => onYearChange(previousHistoricalYear(year))}
              >
                <span aria-hidden="true">−</span>
              </button>
              <div className="year-slider-wrap">
                <input
                  id="historical-year-slider"
                  className="year-slider"
                  type="range"
                  min={toOrdinal(yearBounds.min)}
                  max={toOrdinal(yearBounds.max)}
                  value={toOrdinal(year)}
                  aria-label="历史年份滑杆"
                  aria-valuetext={`${formattedYear}年`}
                  aria-describedby="year-help"
                  onChange={(event) => onYearChange(fromOrdinal(Number(event.currentTarget.value)))}
                />
                <div className="year-range" id="year-help">
                  <span>{formatHistoricalYear({ year: yearBounds.min, precision: "exact" })}</span>
                  <span>自动跳过公元 0 年</span>
                  <span>{formatHistoricalYear({ year: yearBounds.max, precision: "exact" })}</span>
                </div>
              </div>
              <button
                className="year-step-button"
                type="button"
                aria-label="下一年"
                disabled={year === yearBounds.max}
                onClick={() => onYearChange(nextHistoricalYear(year))}
              >
                <span aria-hidden="true">＋</span>
              </button>
            </div>
          </div>
        )}
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
        <button className="button" type="button" disabled={!hasFilters} onClick={onClear}>
          清除筛选
        </button>
      </div>
      {showModeSwitch && mode === "overview" && (
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
