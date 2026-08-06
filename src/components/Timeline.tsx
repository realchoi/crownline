import type { MatchedEntity } from "../domain/selectors";
import type { CrownlineData } from "../domain/types";
import { TimelineStage } from "./TimelineStage";

/** 时间轴列表所需的数据和详情选择事件。 */
interface TimelineProps {
  data: CrownlineData;
  matches: MatchedEntity[];
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
}

/** 按历史阶段组织筛选结果，并处理统一的空结果状态。 */
export function Timeline({ data, matches, onSelect }: TimelineProps) {
  const matchesBySection = new Map<string, MatchedEntity[]>();
  matches.forEach((match) => {
    if (!match.section) return;
    const sectionMatches = matchesBySection.get(match.section.id) ?? [];
    sectionMatches.push(match);
    matchesBySection.set(match.section.id, sectionMatches);
  });

  if (matches.length === 0) {
    return (
      <section id="timeline" aria-label="中国历代王朝时间轴" aria-live="polite">
        <div className="empty-state">
          没有找到匹配条目。
          <br />
          请尝试更短的关键词或切换类别。
        </div>
      </section>
    );
  }

  return (
    <section id="timeline" aria-label="中国历代王朝时间轴" aria-live="polite">
      {data.timelineSections.map((section) => {
        const sectionMatches = matchesBySection.get(section.id);
        if (!sectionMatches) return null;
        return (
          <TimelineStage
            key={section.id}
            section={section}
            matches={sectionMatches}
            onSelect={onSelect}
          />
        );
      })}
    </section>
  );
}
