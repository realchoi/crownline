import { useId } from "react";

import {
  formatHistoricalYear,
  fromOrdinal,
  nextHistoricalYear,
  previousHistoricalYear,
  toOrdinal
} from "../domain/chronology";
import type { HistoricalYearBounds, TimeRange } from "../domain/browseState";
import { YearField } from "./YearField";

interface TimeRangeControlProps {
  value: TimeRange;
  year: number;
  yearBounds: HistoricalYearBounds;
  onChange: (value: TimeRange) => void;
  onYearChange: (year: number) => void;
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
  onYearChange
}: TimeRangeControlProps) {
  const isAllTime = value === "all";
  const formattedYear = formatHistoricalYear({ year, precision: "exact" });
  const yearHelpId = useId();

  return (
    <section
      className={`time-range-control${isAllTime ? " is-overview" : ""}`}
      aria-label="时间范围"
    >
      <div className="time-range-inputs">
        <button
          className="time-all-button"
          type="button"
          aria-pressed={isAllTime}
          onClick={() => onChange("all")}
        >
          全时期
        </button>
        <YearField
          year={year}
          yearBounds={yearBounds}
          isAllTime={isAllTime}
          onYearChange={onYearChange}
        />
      </div>

      <div className="year-slider-row">
        {/* 全时期没有可见的当前年份，步进无从参照，因此禁用。 */}
        <button
          className="year-step-button"
          type="button"
          aria-label="上一年"
          disabled={isAllTime || year === yearBounds.min}
          onClick={() => onYearChange(previousHistoricalYear(year))}
        >
          <span aria-hidden="true">−</span>
        </button>
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
          <div className="year-range" id={yearHelpId}>
            <span>{formatHistoricalYear({ year: yearBounds.min, precision: "exact" })}</span>
            <span>{isAllTime ? "拖动或输入年份即进入该年" : "自动跳过公元 0 年"}</span>
            <span>{formatHistoricalYear({ year: yearBounds.max, precision: "exact" })}</span>
          </div>
        </div>
        <button
          className="year-step-button"
          type="button"
          aria-label="下一年"
          disabled={isAllTime || year === yearBounds.max}
          onClick={() => onYearChange(nextHistoricalYear(year))}
        >
          <span aria-hidden="true">＋</span>
        </button>
      </div>
    </section>
  );
}
