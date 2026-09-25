import { useEffect, useId, useRef, useState } from "react";

import { formatPeriods, toOrdinal } from "../domain/chronology";
import { DISPLAY_CATEGORY_NAMES } from "../domain/displayCategories";
import type { OverviewTimelineGroup } from "../domain/overviewTimeline";
import { getRegionNames } from "../domain/regionScope";
import { buildTimelineAxis } from "../domain/timelineAxis";
import { formatTimeWindow, type TimeWindow } from "../domain/timeWindow";
import type { Region } from "../domain/types";
import { ComparisonToggle } from "./ComparisonToggle";
import { TimelineAxisTicks } from "./TimelineAxisTicks";
import { timelineGridStyle } from "./timelineGrid";

/**
 * 手机布局中长分组默认只预览的行数（已选入对比的行另外保留）；与 responsive.css 中
 * `.timeline-rows.is-collapsed > .timeline-row:nth-child(n + 7)` 保持一致。
 */
const PREVIEW_ROW_COUNT = 6;

/** 至少能收起这么多行才提供开关；只藏一两行时开关本身就和这些行一样占地方。 */
const MIN_HIDDEN_ROW_COUNT = 3;

/** 单个时间轴分组的渲染参数；多地区模式可注入共享比例。 */
interface TimelineStageProps {
  group: OverviewTimelineGroup;
  regions: Region[];
  scaleRange?: OverviewTimelineGroup["range"];
  showAxis?: boolean;
  comparisonEntityIds: string[];
  /** 提供时，阶段坐标轴的刻度分段可点击放大为时间窗口。 */
  onZoom?: (window: TimeWindow) => void;
  onToggleComparison: (entityId: string) => void;
  onSelect: (entityId: string) => void;
}

/**
 * 在传入的时间尺度内绘制实体存在区间。
 * 同一实体的多个存在区间会生成多个时间条，但都指向同一详情记录。
 */
export function TimelineStage({
  group,
  regions,
  scaleRange = group.range,
  showAxis = true,
  comparisonEntityIds,
  onZoom,
  onToggleComparison,
  onSelect
}: TimelineStageProps) {
  const startOrdinal = toOrdinal(scaleRange.startYear);
  const endOrdinal = toOrdinal(scaleRange.endYear);
  const span = endOrdinal - startOrdinal;
  const axis = buildTimelineAxis(scaleRange);
  const headingId = `stage-${group.id}`;
  const rowsId = useId();
  const [expanded, setExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const collapsedByUserRef = useRef(false);
  const collapsible = group.matches.length >= PREVIEW_ROW_COUNT + MIN_HIDDEN_ROW_COUNT;

  // 收起后开关会随行数减少大幅上移；把它带回视口，避免用户失去位置。
  useEffect(() => {
    if (expanded || !collapsedByUserRef.current) return;
    collapsedByUserRef.current = false;
    toggleRef.current?.scrollIntoView?.({ block: "center" });
  }, [expanded]);

  return (
    <section
      className={`timeline-stage timeline-group-${group.kind}`}
      aria-labelledby={headingId}
      style={timelineGridStyle(axis)}
    >
      <div className="stage-heading">
        <h2 className="stage-title" id={headingId}>
          {group.title}
        </h2>
        <span className="stage-range">{group.displayRange}</span>
      </div>

      {showAxis && (
        <div
          className="axis-row"
          role="group"
          aria-label={`阶段时间刻度：${formatTimeWindow(scaleRange)}，每${axis.step}年一格`}
        >
          <span />
          <TimelineAxisTicks axis={axis} range={scaleRange} {...(onZoom ? { onZoom } : {})} />
        </div>
      )}

      <div
        className={`timeline-rows${collapsible && !expanded ? " is-collapsed" : ""}`}
        id={rowsId}
      >
        {group.matches.map(({ entity }) => {
          const displayRange = formatPeriods(entity.existencePeriods, entity.displayRangeOverride);
          const comparisonSelected = comparisonEntityIds.includes(entity.id);
          const regionNames =
            group.kind === "cross-region"
              ? getRegionNames(regions, entity.historicalRegionIds)
              : [];
          return (
            <div
              className={`timeline-row${comparisonSelected ? " is-comparison-selected" : ""}`}
              key={entity.id}
            >
              <div className="row-label">
                <button
                  className="row-name"
                  type="button"
                  aria-label={`查看${entity.names.primary}详情`}
                  title={`查看${entity.names.primary}详情`}
                  onClick={() => onSelect(entity.id)}
                >
                  {entity.names.primary}
                </button>
                <div className="row-years" title={displayRange}>
                  {displayRange}
                </div>
                {regionNames.length > 0 && (
                  <div className="row-regions" title={regionNames.join(" · ")}>
                    {regionNames.join(" · ")}
                  </div>
                )}
                {entity.entityKind === "polity" && (
                  <ComparisonToggle
                    entityName={entity.names.primary}
                    selected={comparisonSelected}
                    disabled={comparisonEntityIds.length >= 2}
                    onToggle={() => onToggleComparison(entity.id)}
                  />
                )}
              </div>
              <div className="track">
                {entity.existencePeriods.map((period) => {
                  // 区间先裁剪到比例尺边界，再换算为轨道上的百分比位置；完全在比例尺外的区间不绘制。
                  const periodStart = toOrdinal(period.start.year);
                  const periodEnd = toOrdinal(period.end.year);
                  if (periodEnd < startOrdinal || periodStart > endOrdinal) return null;
                  const clippedStart = Math.max(periodStart, startOrdinal);
                  const clippedEnd = Math.min(periodEnd, endOrdinal);
                  const left = ((clippedStart - startOrdinal) / span) * 100;
                  const rawWidth = ((clippedEnd - clippedStart) / span) * 100;
                  // 时间条只表达真实比例；详情入口由左侧名称提供足够大的点击区域。
                  const width = Math.min(100 - Math.max(0, left), rawWidth);
                  const periodLabel = formatPeriods([period]);
                  const categoryLabel = DISPLAY_CATEGORY_NAMES[entity.displayCategory];
                  return (
                    <button
                      className={`timeline-bar bar-${entity.displayCategory}${periodStart < startOrdinal ? " is-clipped-start" : ""}${periodEnd > endOrdinal ? " is-clipped-end" : ""}`}
                      key={`${period.start.year}-${period.end.year}`}
                      type="button"
                      style={{ left: `${Math.max(0, left)}%`, width: `${width}%` }}
                      title={`${entity.names.primary}｜${periodLabel}`}
                      aria-label={`${entity.names.primary}，${periodLabel}，${categoryLabel}。点击查看详情。`}
                      onClick={() => onSelect(entity.id)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 仅手机布局显示；桌面完整展示全部行。 */}
      {collapsible && (
        <button
          ref={toggleRef}
          className="timeline-rows-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={rowsId}
          onClick={() => {
            collapsedByUserRef.current = expanded;
            setExpanded(!expanded);
          }}
        >
          {expanded ? `收起${group.title}` : `展开${group.title}全部 ${group.matches.length} 条`}
        </button>
      )}
    </section>
  );
}
