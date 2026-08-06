import { useEffect, useState } from "react";

import {
  formatHistoricalYear,
  fromOrdinal,
  nextHistoricalYear,
  parseHistoricalYear,
  previousHistoricalYear,
  toOrdinal
} from "../domain/chronology";
import type { BrowseMode, HistoricalYearBounds } from "../domain/browseState";
import type { CategoryFilter } from "../domain/selectors";
import type { DisplayCategory } from "../domain/types";

/** 展示类别对应的中文界面名称。 */
export const DISPLAY_CATEGORY_NAMES: Record<DisplayCategory, string> = {
  mainline: "主线王朝",
  contemporary: "主要并立政权",
  context: "历史分期",
  regional: "区域政权"
};

/** 筛选面板的受控状态与事件。 */
interface FilterPanelProps {
  mode: BrowseMode;
  year: number;
  yearBounds: HistoricalYearBounds;
  query: string;
  category: CategoryFilter;
  onModeChange: (mode: BrowseMode) => void;
  onYearChange: (year: number) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onClear: () => void;
}

/** 渲染搜索、类别筛选、清除按钮和类别图例。 */
export function FilterPanel({
  mode,
  year,
  yearBounds,
  query,
  category,
  onModeChange,
  onYearChange,
  onQueryChange,
  onCategoryChange,
  onClear
}: FilterPanelProps) {
  const hasFilters = query.trim().length > 0 || category !== "all";
  const formattedYear = formatHistoricalYear({ year, precision: "exact" });
  const [yearDraft, setYearDraft] = useState(formattedYear);
  const [yearError, setYearError] = useState<string | null>(null);

  useEffect(() => {
    setYearDraft(formattedYear);
    setYearError(null);
  }, [formattedYear]);

  const commitYear = () => {
    const parsedYear = parseHistoricalYear(yearDraft);
    if (parsedYear === null) {
      const isYearZero = /^(?:-?0|前\s*0|公元前\s*0|公元\s*0)$/.test(yearDraft.trim());
      setYearError(
        isYearZero
          ? "历史纪年不存在公元 0 年。"
          : "请输入整数年份；公元前可输入“前221”或“-221”。"
      );
      return;
    }
    if (parsedYear < yearBounds.min || parsedYear > yearBounds.max) {
      setYearError(
        `可浏览范围为${formatHistoricalYear({ year: yearBounds.min, precision: "exact" })}—${formatHistoricalYear({ year: yearBounds.max, precision: "exact" })}。`
      );
      return;
    }
    setYearError(null);
    onYearChange(parsedYear);
  };

  return (
    <section className={`controls-panel controls-${mode}`} aria-label="浏览与筛选工具">
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
        {mode === "overview" && (
          <p className="mode-description">浏览完整时间轴，观察政权的兴替与并存。</p>
        )}
      </div>

      {mode === "point" && (
        <div className="year-panel">
          <div className="year-stepper">
            <button
              className="year-step-button"
              type="button"
              aria-label="上一年"
              disabled={year === yearBounds.min}
              onClick={() => onYearChange(previousHistoricalYear(year))}
            >
              <span aria-hidden="true">−</span>
            </button>
            <label className="year-input-label">
              <span className="field-label">当前年份</span>
              <input
                className="year-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={yearError ? "true" : undefined}
                aria-describedby={yearError ? "year-error" : "year-help"}
                value={yearDraft}
                onChange={(event) => setYearDraft(event.currentTarget.value)}
                onBlur={commitYear}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitYear();
                }}
              />
            </label>
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
          <div className="year-slider-wrap">
            <label className="field-label" htmlFor="historical-year-slider">
              历史年份滑杆
            </label>
            <input
              id="historical-year-slider"
              className="year-slider"
              type="range"
              min={toOrdinal(yearBounds.min)}
              max={toOrdinal(yearBounds.max)}
              value={toOrdinal(year)}
              aria-valuetext={`${formattedYear}年`}
              onChange={(event) => onYearChange(fromOrdinal(Number(event.currentTarget.value)))}
            />
            <div className="year-range" id="year-help">
              <span>{formatHistoricalYear({ year: yearBounds.min, precision: "exact" })}</span>
              <span>跨公元前后时自动跳过公元 0 年</span>
              <span>{formatHistoricalYear({ year: yearBounds.max, precision: "exact" })}</span>
            </div>
          </div>
          {yearError && (
            <p className="year-error" id="year-error" role="alert">
              {yearError}
            </p>
          )}
        </div>
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
        <button className="button" type="button" disabled={!hasFilters} onClick={onClear}>
          清除筛选
        </button>
      </div>
      {mode === "overview" && (
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
