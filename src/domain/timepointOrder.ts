import { toOrdinal } from "./chronology";
import type { MatchedEntity } from "./selectors";
import type { DisplayCategory } from "./types";

/** 年份切片中类别的呈现顺序：主线在前，历史分期背景在最后。 */
const CATEGORY_RANK: Record<DisplayCategory, number> = {
  mainline: 0,
  contemporary: 1,
  regional: 2,
  context: 3
};

function startOrdinal({ entity }: MatchedEntity): number {
  return Math.min(...entity.existencePeriods.map(({ start }) => toOrdinal(start.year)));
}

function endOrdinal({ entity }: MatchedEntity): number {
  return Math.max(...entity.existencePeriods.map(({ end }) => toOrdinal(end.year)));
}

/** 按类别、起始年代、终止年代、名称与 ID 稳定排序，结果不依赖输入顺序。 */
export function sortTimepointMatches(matches: MatchedEntity[]): MatchedEntity[] {
  return [...matches].sort((left, right) => {
    return (
      CATEGORY_RANK[left.entity.displayCategory] - CATEGORY_RANK[right.entity.displayCategory] ||
      startOrdinal(left) - startOrdinal(right) ||
      endOrdinal(left) - endOrdinal(right) ||
      left.entity.names.primary.localeCompare(right.entity.names.primary, "zh-CN") ||
      left.entity.id.localeCompare(right.entity.id)
    );
  });
}
