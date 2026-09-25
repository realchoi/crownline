import { formatHistoricalYear } from "../domain/chronology";
import type { TimelineAxis, TimelineAxisRange } from "../domain/timelineAxis";
import { formatTimeWindow, listZoomSegments, type TimeWindow } from "../domain/timeWindow";

/** 贴近轨道两端的刻度文字改为向内对齐，避免溢出轨道。 */
const EDGE_ALIGN_THRESHOLD = 4;

/** 刻度年份文案；公元 1 年标记为公元前后分界。 */
function formatTickYear(year: number): string {
  return year === 1 ? "公元元年" : formatHistoricalYear({ year, precision: "exact" });
}

interface TimelineAxisTicksProps {
  axis: TimelineAxis;
  range: TimelineAxisRange;
  /** 提供时，刻度之间的每一段都是可点击放大的按钮。 */
  onZoom?: (window: TimeWindow) => void;
}

/** 坐标轴上的整数年代刻度文字，位置与轨道网格线一致；可选地把刻度分段作为放大入口。 */
export function TimelineAxisTicks({ axis, range, onZoom }: TimelineAxisTicksProps) {
  return (
    <div className="axis-labels">
      <div className="axis-tick-layer" aria-hidden="true">
        {axis.ticks.map(({ year, position }) => {
          const edge =
            position < EDGE_ALIGN_THRESHOLD
              ? " is-start"
              : position > 100 - EDGE_ALIGN_THRESHOLD
                ? " is-end"
                : "";
          return (
            <span className={`axis-tick${edge}`} key={year} style={{ left: `${position}%` }}>
              {formatTickYear(year)}
            </span>
          );
        })}
      </div>
      {onZoom &&
        listZoomSegments(range, axis).map(({ startYear, endYear, left, width }) => {
          const label = `放大到 ${formatTimeWindow({ startYear, endYear })}`;
          return (
            <button
              className="axis-zoom-segment"
              key={`${startYear}-${endYear}`}
              type="button"
              aria-label={label}
              title={label}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onZoom({ startYear, endYear })}
            />
          );
        })}
    </div>
  );
}
