import { useId, useMemo } from "react";

import {
  formatHistoricalYear,
  fromOrdinal,
  nextHistoricalYear,
  previousHistoricalYear,
  toOrdinal
} from "../domain/chronology";
import type { HistoricalYearBounds, TimeRange } from "../domain/browseState";
import { buildTimelineAxis } from "../domain/timelineAxis";
import { YearField } from "./YearField";

interface TimeRangeControlProps {
  value: TimeRange;
  year: number;
  yearBounds: HistoricalYearBounds;
  onChange: (value: TimeRange) => void;
  onYearChange: (year: number) => void;
  /** `compact` 用于滚动后的工具条与移动端首屏：只保留全时期、年份框与步进，不含滑杆。 */
  variant?: "full" | "compact";
}

/** 刻度尺最多标注的年代数；窄屏由样式隐藏隔位的次要刻度。 */
const RULER_MAX_TICKS = 9;

/** 刻度文案；公元 1 年标记为公元前后分界。 */
function formatRulerYear(year: number): string {
  return year === 1 ? "元年" : formatHistoricalYear({ year, precision: "exact" });
}

/**
 * 时间轴与地图共享的唯一时间控件：“全时期”按钮退出年份，
 * 年份框、步进与滑杆任一操作都进入指定年份。
 */
export function TimeRangeControl({
  value,
  year,
  yearBounds,
  onChange,
  onYearChange,
  variant = "full"
}: TimeRangeControlProps) {
  const isAllTime = value === "all";
  const formattedYear = formatHistoricalYear({ year, precision: "exact" });
  const yearHelpId = useId();
  const ruler = useMemo(
    () =>
      buildTimelineAxis({ startYear: yearBounds.min, endYear: yearBounds.max }, RULER_MAX_TICKS),
    [yearBounds.min, yearBounds.max]
  );

  const allTimeButton = (
    <button
      className="time-all-button"
      type="button"
      aria-pressed={isAllTime}
      onClick={() => onChange("all")}
    >
      全时期
    </button>
  );
  const yearField = (
    <YearField
      year={year}
      yearBounds={yearBounds}
      isAllTime={isAllTime}
      onYearChange={onYearChange}
    />
  );
  // 全时期没有可见的当前年份，步进无从参照，因此禁用。
  const previousButton = (
    <button
      className="year-step-button"
      type="button"
      aria-label="上一年"
      disabled={isAllTime || year === yearBounds.min}
      onClick={() => onYearChange(previousHistoricalYear(year))}
    >
      <span aria-hidden="true">−</span>
    </button>
  );
  const nextButton = (
    <button
      className="year-step-button"
      type="button"
      aria-label="下一年"
      disabled={isAllTime || year === yearBounds.max}
      onClick={() => onYearChange(nextHistoricalYear(year))}
    >
      <span aria-hidden="true">＋</span>
    </button>
  );

  if (variant === "compact") {
    return (
      <section
        className={`time-range-control is-compact${isAllTime ? " is-overview" : ""}`}
        aria-label="时间范围"
      >
        {allTimeButton}
        {yearField}
        <div className="year-step-pair">
          {previousButton}
          {nextButton}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`time-range-control${isAllTime ? " is-overview" : ""}`}
      aria-label="时间范围"
    >
      <span className="field-label time-range-label" aria-hidden="true">
        时间
      </span>
      <div className="time-range-inputs">
        {allTimeButton}
        {yearField}
      </div>

      <div className="year-slider-row">
        {previousButton}
        <div className="year-slider-wrap">
          <input
            className="year-slider"
            type="range"
            min={toOrdinal(yearBounds.min)}
            max={toOrdinal(yearBounds.max)}
            value={toOrdinal(year)}
            aria-label={isAllTime ? "选择历史年份，调整后进入指定年份" : "历史年份滑杆"}
            aria-valuetext={
              isAllTime ? `${formattedYear}年，调整后进入指定年份` : `${formattedYear}年`
            }
            aria-describedby={yearHelpId}
            onChange={(event) => onYearChange(fromOrdinal(Number(event.currentTarget.value)))}
          />
          {/* 刻度与滑杆轨道对齐，只作视觉参照；读屏以 aria-valuetext 与下方说明为准。 */}
          <div className="year-ruler-ticks" aria-hidden="true">
            {ruler.ticks.map(({ year: tickYear, position }, index) => (
              <span
                key={tickYear}
                className={`year-ruler-tick${index % 2 === 1 ? " is-minor" : ""}`}
                style={{ left: `${position}%` }}
              >
                {formatRulerYear(tickYear)}
              </span>
            ))}
          </div>
          <div className="year-range visually-hidden" id={yearHelpId}>
            <span>{formatHistoricalYear({ year: yearBounds.min, precision: "exact" })}</span>
            <span>{isAllTime ? "拖动或输入年份即进入该年" : "自动跳过公元 0 年"}</span>
            <span>{formatHistoricalYear({ year: yearBounds.max, precision: "exact" })}</span>
          </div>
        </div>
        {nextButton}
      </div>
    </section>
  );
}
