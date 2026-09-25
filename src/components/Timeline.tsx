import { formatHistoricalYear, fromOrdinal, toOrdinal } from "../domain/chronology";
import type { OverviewTimelineGroup } from "../domain/overviewTimeline";
import type { RegionScope } from "../domain/regionScope";
import { buildTimelineAxis } from "../domain/timelineAxis";
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
  comparisonEntityIds: string[];
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
  comparisonEntityIds,
  onToggleComparison,
  onSelect
}: TimelineProps) {
  const sharedRange =
    regionScope.mode !== "china" && groups.length > 0
      ? {
          startYear: fromOrdinal(
            Math.min(...groups.map(({ range }) => toOrdinal(range.startYear)))
          ),
          endYear: fromOrdinal(Math.max(...groups.map(({ range }) => toOrdinal(range.endYear))))
        }
      : null;
  const sharedAxis = sharedRange ? buildTimelineAxis(sharedRange) : null;
  const sharedRangeLabel = sharedRange
    ? `${formatHistoricalYear({ year: sharedRange.startYear, precision: "exact" })}—${formatHistoricalYear({ year: sharedRange.endYear, precision: "exact" })}`
    : "";
  const timelineLabel = regionScope.mode === "china" ? "中国历代王朝时间轴" : "多地区完整时间轴";
  const selectedRegionNames =
    regionScope.mode === "custom"
      ? regions
          .filter(({ id }) => regionScope.regionIds.includes(id))
          .map(({ names }) => names.primary)
      : [];
  const scopeName =
    regionScope.mode === "global" ? "全球已收录范围" : selectedRegionNames.join("、");

  if (matchCount === 0) {
    return (
      <section id="timeline" aria-label={timelineLabel}>
        <div className="empty-state">
          {emptyReason === "unindexed" ? (
            <>{scopeName}尚未收录代表性政权；这不表示该地区在历史上没有政权。</>
          ) : (
            <>
              没有找到匹配条目。
              <br />
              请尝试更短的关键词或切换类别。
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    // 结果数量变化由结果摘要的 role="status" 播报；整段时间轴不设 live region，避免读屏逐行朗读。
    <section id="timeline" aria-label={timelineLabel}>
      {sharedAxis && (
        <div
          className="timeline-shared-axis"
          role="img"
          aria-label={`统一时间刻度：${sharedRangeLabel}，每${sharedAxis.step}年一格`}
        >
          <span className="shared-axis-caption">
            统一时间比例
            <span className="shared-axis-range">{sharedRangeLabel}</span>
          </span>
          <TimelineAxisTicks axis={sharedAxis} />
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
          onToggleComparison={onToggleComparison}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}
