import {
  formatHistoricalYear,
  fromOrdinal,
  nextHistoricalYear,
  previousHistoricalYear,
  toOrdinal
} from "../domain/chronology";
import type { HistoricalYearBounds, TimeRange } from "../domain/browseState";

interface TimeRangeControlProps {
  value: TimeRange;
  year: number;
  yearBounds: HistoricalYearBounds;
  onChange: (value: TimeRange) => void;
  onYearChange: (year: number) => void;
}

/** 时间轴与地图共享的时间范围和历史年份控制。 */
export function TimeRangeControl({
  value,
  year,
  yearBounds,
  onChange,
  onYearChange
}: TimeRangeControlProps) {
  const isAllTime = value === "all";
  const formattedYear = formatHistoricalYear({ year, precision: "exact" });

  return (
    <section className="time-range-control" aria-label="时间范围">
      <div className="time-range-heading">
        <div>
          <span className="field-label">时间范围</span>
          <div className="mode-switch" role="group" aria-label="时间范围选择">
            <button type="button" aria-pressed={isAllTime} onClick={() => onChange("all")}>
              全时期
            </button>
            <button type="button" aria-pressed={!isAllTime} onClick={() => onChange("year")}>
              指定年份
            </button>
          </div>
        </div>
        <div className={`year-current${isAllTime ? " is-overview" : ""}`}>
          <span className="field-label">{isAllTime ? "当前范围" : "当前年份"}</span>
          <span
            className="year-current-value"
            aria-label={isAllTime ? "当前时间范围" : "当前年份"}
            aria-live="polite"
          >
            {isAllTime ? "全时期" : formattedYear}
          </span>
        </div>
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
            aria-label={isAllTime ? "选择历史年份，调整后进入指定年份" : "历史年份滑杆"}
            aria-valuetext={
              isAllTime ? `${formattedYear}年，调整后进入指定年份` : `${formattedYear}年`
            }
            aria-describedby="year-help"
            onChange={(event) => onYearChange(fromOrdinal(Number(event.currentTarget.value)))}
          />
          <div className="year-range" id="year-help">
            <span>{formatHistoricalYear({ year: yearBounds.min, precision: "exact" })}</span>
            <span>{isAllTime ? "调整后进入指定年份" : "自动跳过公元 0 年"}</span>
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
    </section>
  );
}
