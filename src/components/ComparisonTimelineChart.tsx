import { formatHistoricalYear, formatPeriods } from "../domain/chronology";
import { buildComparisonChart } from "../domain/comparisonChart";
import type { PolityComparison } from "../domain/polityComparison";
import { buildTimelineAxis } from "../domain/timelineAxis";
import type { HistoricalEntity } from "../domain/types";
import { TimelineAxisTicks } from "./TimelineAxisTicks";
import { timelineGridStyle } from "./timelineGrid";

/** 对比图刻度更稀疏，避免弹窗窄栏中的年份文字拥挤。 */
const CHART_MAX_TICKS = 6;

interface ComparisonTimelineChartProps {
  comparison: PolityComparison;
  currentYear?: number;
}

function describeEntity(entity: HistoricalEntity): string {
  return `${entity.names.primary} ${formatPeriods(entity.existencePeriods, entity.displayRangeOverride)}`;
}

/**
 * 双轨时间对比图：两条轨道分别绘制双方存续区间，共同存续区间以贯穿两轨的色带标出。
 * 图形整体作为一张图像提供文字替代，与上方的文字摘要互为补充。
 */
export function ComparisonTimelineChart({ comparison, currentYear }: ComparisonTimelineChartProps) {
  const chart = buildComparisonChart(comparison, currentYear);
  const axis = buildTimelineAxis(chart.range, CHART_MAX_TICKS);
  const label = [
    `时间对比图：${describeEntity(comparison.left)}`,
    describeEntity(comparison.right),
    comparison.overlapPeriods.length > 0
      ? `共同存续 ${formatPeriods(comparison.overlapPeriods)}`
      : "存续时间没有重叠",
    ...(chart.currentYearPosition !== undefined && currentYear !== undefined
      ? [`当前年份 ${formatHistoricalYear({ year: currentYear, precision: "exact" })}`]
      : [])
  ].join("；");

  return (
    <figure className="comparison-chart" role="img" aria-label={label}>
      <div className="comparison-chart-body" style={timelineGridStyle(axis)}>
        <div className="comparison-chart-plot">
          {(["A", "B"] as const).map((slot, index) => (
            <div className="comparison-chart-row" key={slot}>
              <span className="comparison-chart-slot">{slot}</span>
              <div
                className={`comparison-chart-track comparison-chart-track-${slot.toLowerCase()}`}
              >
                {chart.tracks[index]!.map((bar) => (
                  <span
                    className="comparison-chart-bar"
                    key={`${bar.left}-${bar.width}`}
                    style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="comparison-chart-overlay">
            {chart.overlaps.map((overlap) => (
              <span
                className="comparison-chart-overlap"
                key={`${overlap.left}-${overlap.width}`}
                style={{ left: `${overlap.left}%`, width: `${overlap.width}%` }}
              />
            ))}
            {chart.currentYearPosition !== undefined && (
              <span
                className="comparison-chart-current"
                style={{ left: `${chart.currentYearPosition}%` }}
              />
            )}
          </div>
        </div>
        <div className="comparison-chart-axis">
          <TimelineAxisTicks axis={axis} range={chart.range} />
        </div>
      </div>
    </figure>
  );
}
