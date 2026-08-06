import { buildOverviewTimelineGroups } from "../domain/overviewTimeline";
import type { RegionScope } from "../domain/regionScope";
import type { MatchedEntity } from "../domain/selectors";
import type { CrownlineData, Region } from "../domain/types";
import { TimelineStage } from "./TimelineStage";

/** 时间轴列表所需的数据和详情选择事件。 */
interface TimelineProps {
  data: CrownlineData;
  matches: MatchedEntity[];
  regions: Region[];
  regionScope: RegionScope;
  emptyReason: "unindexed" | "limited-coverage" | "filtered-out" | null;
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
}

/** 按中国历史阶段或动态地区组织全览结果，并处理资料覆盖空状态。 */
export function Timeline({
  data,
  matches,
  regions,
  regionScope,
  emptyReason,
  onSelect
}: TimelineProps) {
  const groups = buildOverviewTimelineGroups(data, matches, regionScope);
  const timelineLabel = regionScope.mode === "china" ? "中国历代王朝时间轴" : "多地区完整时间轴";
  const selectedRegionNames = regionScope.mode === "custom"
    ? regions.filter(({ id }) => regionScope.regionIds.includes(id)).map(({ names }) => names.primary)
    : [];
  const scopeName = regionScope.mode === "global"
    ? "全球已收录范围"
    : selectedRegionNames.join("、");

  if (matches.length === 0) {
    return (
      <section id="timeline" aria-label={timelineLabel} aria-live="polite">
        <div className="empty-state">
          {emptyReason === "unindexed" ? (
            <>{scopeName}尚未收录代表性政权；这不表示该地区在历史上没有政权。</>
          ) : (
            <>没有找到匹配条目。<br />请尝试更短的关键词或切换类别。</>
          )}
        </div>
      </section>
    );
  }

  return (
    <section id="timeline" aria-label={timelineLabel} aria-live="polite">
      {groups.map((group) => (
        <TimelineStage
          key={group.id}
          group={group}
          regions={regions}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}
