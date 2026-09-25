import type { HistoricalYearBounds } from "../domain/browseState";
import { fromOrdinal, toOrdinal } from "../domain/chronology";
import type { OverviewTimelineGroup } from "../domain/overviewTimeline";
import type { RegionScope } from "../domain/regionScope";
import { buildTimelineAxis } from "../domain/timelineAxis";
import { formatTimeWindow, zoomOutTimeWindow, type TimeWindow } from "../domain/timeWindow";
import type { Region } from "../domain/types";
import { TimelineAxisTicks } from "./TimelineAxisTicks";
import { TimelineStage } from "./TimelineStage";

/** 时间轴列表所需的已分组结果和详情选择事件。 */
interface TimelineProps {
  groups: OverviewTimelineGroup[];
  matchCount: number;
  regions: Region[];
  regionScope: RegionScope;
  emptyReason: "unindexed" | "limited-coverage" | "filtered-out" | null;
  /** 生效中的放大窗口；null 时中国范围按阶段、其他范围按全部分组计算比例。 */
  timeWindow: TimeWindow | null;
  yearBounds: HistoricalYearBounds;
  comparisonEntityIds: string[];
  onTimeWindowChange: (window: TimeWindow | null) => void;
  onToggleComparison: (entityId: string) => void;
  onSelect: (entityId: string) => void;
}

/** 按中国历史阶段或动态地区组织全览结果，并处理资料覆盖空状态。 */
export function Timeline({
  groups,
  matchCount,
  regions,
  regionScope,
  emptyReason,
  timeWindow,
  yearBounds,
  comparisonEntityIds,
  onTimeWindowChange,
  onToggleComparison,
  onSelect
}: TimelineProps) {
  // 放大后所有分组共用窗口比例；否则中国范围沿用各阶段比例，多地区范围共用全部分组的并集。
  const sharedRange =
    timeWindow ??
    (regionScope.mode !== "china" && groups.length > 0
      ? {
          startYear: fromOrdinal(
            Math.min(...groups.map(({ range }) => toOrdinal(range.startYear)))
          ),
          endYear: fromOrdinal(Math.max(...groups.map(({ range }) => toOrdinal(range.endYear))))
        }
      : null);
  const sharedAxis = sharedRange ? buildTimelineAxis(sharedRange) : null;
  const sharedRangeLabel = sharedRange ? formatTimeWindow(sharedRange) : "";
  const timelineLabel = regionScope.mode === "china" ? "中国历代王朝时间轴" : "多地区完整时间轴";
  const selectedRegionNames =
    regionScope.mode === "custom"
      ? regions
          .filter(({ id }) => regionScope.regionIds.includes(id))
          .map(({ names }) => names.primary)
      : [];
  const scopeName =
    regionScope.mode === "global" ? "全球已收录范围" : selectedRegionNames.join("、");
  const renderResetButton = (text: string) => (
    <button
      className="axis-window-button"
      type="button"
      aria-label="恢复全时期"
      onClick={() => onTimeWindowChange(null)}
    >
      {text}
    </button>
  );

  if (matchCount === 0) {
    return (
      <section id="timeline" aria-label={timelineLabel}>
        <div className="empty-state">
          {emptyReason === "unindexed" ? (
            <>{scopeName}尚未收录代表性政权；这不表示该地区在历史上没有政权。</>
          ) : timeWindow && emptyReason === "limited-coverage" ? (
            <>
              时间窗口 {formatTimeWindow(timeWindow)} 内暂无已收录条目；这不表示该时期没有政权。
              <br />
              {renderResetButton("恢复全时期")}
            </>
          ) : (
            <>
              没有找到匹配条目。
              <br />
              请尝试更短的关键词或切换类别。
              {timeWindow && (
                <>
                  <br />
                  {renderResetButton("恢复全时期")}
                </>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    // 结果数量变化由结果摘要的 role="status" 播报；整段时间轴不设 live region，避免读屏逐行朗读。
    <section id="timeline" aria-label={timelineLabel}>
      {sharedRange && sharedAxis && (
        <div
          className={`timeline-shared-axis${timeWindow ? " has-window" : ""}`}
          role="group"
          aria-label={`${timeWindow ? "时间窗口刻度" : "统一时间刻度"}：${sharedRangeLabel}，每${sharedAxis.step}年一格`}
        >
          <div className="shared-axis-caption">
            <span className="shared-axis-title">{timeWindow ? "时间窗口" : "统一时间比例"}</span>
            <span className="shared-axis-range">{sharedRangeLabel}</span>
            {timeWindow && (
              <span className="axis-window-actions">
                <button
                  className="axis-window-button"
                  type="button"
                  aria-label="缩小时间窗口"
                  onClick={() => onTimeWindowChange(zoomOutTimeWindow(timeWindow, yearBounds))}
                >
                  缩小
                </button>
                {renderResetButton("全时期")}
              </span>
            )}
          </div>
          <TimelineAxisTicks axis={sharedAxis} range={sharedRange} onZoom={onTimeWindowChange} />
        </div>
      )}
      {groups.map((group) => (
        <TimelineStage
          key={group.id}
          group={group}
          regions={regions}
          scaleRange={sharedRange ?? group.range}
          showAxis={!sharedRange}
          comparisonEntityIds={comparisonEntityIds}
          onZoom={onTimeWindowChange}
          onToggleComparison={onToggleComparison}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}
