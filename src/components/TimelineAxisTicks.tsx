import { formatHistoricalYear } from "../domain/chronology";
import type { TimelineAxis } from "../domain/timelineAxis";

/** 贴近轨道两端的刻度文字改为向内对齐，避免溢出轨道。 */
const EDGE_ALIGN_THRESHOLD = 4;

/** 刻度年份文案；公元 1 年标记为公元前后分界。 */
function formatTickYear(year: number): string {
  return year === 1 ? "公元元年" : formatHistoricalYear({ year, precision: "exact" });
}

/** 坐标轴上的整数年代刻度文字，位置与轨道网格线一致。 */
export function TimelineAxisTicks({ axis }: { axis: TimelineAxis }) {
  return (
    <div className="axis-labels" aria-hidden="true">
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
  );
}
