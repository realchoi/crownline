import { fromOrdinal, formatHistoricalYear, formatPeriods, toOrdinal } from "../domain/chronology";
import type { OverviewTimelineGroup } from "../domain/overviewTimeline";
import type { Region } from "../domain/types";
import { DISPLAY_CATEGORY_NAMES } from "./FilterPanel";

/** 单个局部时间尺度阶段的渲染参数。 */
interface TimelineStageProps {
  group: OverviewTimelineGroup;
  regions: Region[];
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
}

/**
 * 在阶段自己的时间尺度内绘制实体存在区间。
 * 同一实体的多个存在区间会生成多个时间条，但都指向同一详情记录。
 */
export function TimelineStage({ group, regions, onSelect }: TimelineStageProps) {
  const startOrdinal = toOrdinal(group.range.startYear);
  const endOrdinal = toOrdinal(group.range.endYear);
  const span = endOrdinal - startOrdinal;
  const midpoint = fromOrdinal(Math.round((startOrdinal + endOrdinal) / 2));
  const headingId = `stage-${group.id}`;

  return (
    <section className={`timeline-stage timeline-group-${group.kind}`} aria-labelledby={headingId}>
      <div className="stage-heading">
        <h2 className="stage-title" id={headingId}>
          {group.title}
        </h2>
        <span className="stage-range">{group.displayRange}</span>
      </div>

      <div className="axis-row" aria-hidden="true">
        <span />
        <div className="axis-labels">
          {[group.range.startYear, midpoint, group.range.endYear].map((year) => (
            <span key={year}>{formatHistoricalYear({ year, precision: "exact" })}</span>
          ))}
        </div>
      </div>

      {group.matches.map(({ entity }) => {
        const displayRange = formatPeriods(entity.existencePeriods, entity.displayRangeOverride);
        const regionNames = group.kind === "cross-region"
          ? entity.historicalRegionIds.flatMap((regionId) => {
              const region = regions.find(({ id }) => id === regionId);
              return region ? [region.names.primary] : [];
            })
          : [];
        return (
          <div className="timeline-row" key={entity.id}>
            <div className="row-label">
              <div className="row-name" title={entity.names.primary}>
                {entity.names.primary}
              </div>
              <div className="row-years" title={displayRange}>
                {displayRange}
              </div>
              {regionNames.length > 0 && (
                <div className="row-regions" title={regionNames.join(" · ")}>
                  {regionNames.join(" · ")}
                </div>
              )}
            </div>
            <div className="track">
              {entity.existencePeriods.map((period) => {
                // 区间先裁剪到阶段边界，再换算为轨道上的百分比位置。
                const clippedStart = Math.max(toOrdinal(period.start.year), startOrdinal);
                const clippedEnd = Math.min(toOrdinal(period.end.year), endOrdinal);
                const left = ((clippedStart - startOrdinal) / span) * 100;
                const rawWidth = ((clippedEnd - clippedStart) / span) * 100;
                // 极短政权保留最小可点击宽度，同时不得溢出轨道右侧。
                const width = Math.min(100 - Math.max(0, left), Math.max(rawWidth, 1.1));
                const periodLabel = formatPeriods([period]);
                const categoryLabel = DISPLAY_CATEGORY_NAMES[entity.displayCategory];
                return (
                  <button
                    className={`timeline-bar bar-${entity.displayCategory}`}
                    key={`${period.start.year}-${period.end.year}`}
                    type="button"
                    style={{ left: `${Math.max(0, left)}%`, width: `${width}%` }}
                    title={`${entity.names.primary}｜${periodLabel}`}
                    aria-label={`${entity.names.primary}，${periodLabel}，${categoryLabel}。点击查看详情。`}
                    onClick={(event) => onSelect(entity.id, event.currentTarget)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
