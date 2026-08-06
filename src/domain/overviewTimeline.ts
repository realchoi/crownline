import { formatHistoricalYear, fromOrdinal, toOrdinal } from "./chronology";
import type { RegionScope } from "./regionScope";
import type { MatchedEntity } from "./selectors";
import type { CrownlineData, Region } from "./types";

/** 全览时间轴使用的通用分组；中国阶段与动态地区组共享同一渲染契约。 */
export interface OverviewTimelineGroup {
  id: string;
  title: string;
  displayRange: string;
  range: { startYear: number; endYear: number };
  matches: MatchedEntity[];
  regionId?: string;
  kind: "china-section" | "region" | "cross-region";
}

/** 向上追溯到历史地区树的顶层节点。 */
function getTopLevelRegionId(regionId: string, regionById: Map<string, Region>): string | null {
  let current = regionById.get(regionId);
  if (!current || current.regionKind !== "historical-region") return null;
  const visited = new Set<string>();
  while (current.parentRegionId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = regionById.get(current.parentRegionId);
    if (!parent || parent.regionKind !== "historical-region") break;
    current = parent;
  }
  return current.id;
}

/** 让地区组内实体保持稳定的年代优先顺序。 */
function sortMatches(matches: MatchedEntity[]): MatchedEntity[] {
  return [...matches].sort((left, right) => {
    const leftStart = Math.min(...left.entity.existencePeriods.map(({ start }) => toOrdinal(start.year)));
    const rightStart = Math.min(...right.entity.existencePeriods.map(({ start }) => toOrdinal(start.year)));
    if (leftStart !== rightStart) return leftStart - rightStart;
    const leftEnd = Math.max(...left.entity.existencePeriods.map(({ end }) => toOrdinal(end.year)));
    const rightEnd = Math.max(...right.entity.existencePeriods.map(({ end }) => toOrdinal(end.year)));
    return leftEnd - rightEnd || left.entity.names.primary.localeCompare(right.entity.names.primary, "zh-CN");
  });
}

/** 从组内实体推导标题年代与安全的分组范围。 */
function getGroupRange(matches: MatchedEntity[]) {
  const startOrdinal = Math.min(
    ...matches.flatMap(({ entity }) => entity.existencePeriods.map(({ start }) => toOrdinal(start.year)))
  );
  const actualEndOrdinal = Math.max(
    ...matches.flatMap(({ entity }) => entity.existencePeriods.map(({ end }) => toOrdinal(end.year)))
  );
  const startYear = fromOrdinal(startOrdinal);
  const actualEndYear = fromOrdinal(actualEndOrdinal);
  const endYear = fromOrdinal(actualEndOrdinal === startOrdinal ? actualEndOrdinal + 1 : actualEndOrdinal);
  const startLabel = formatHistoricalYear({ year: startYear, precision: "exact" });
  const endLabel = formatHistoricalYear({ year: actualEndYear, precision: "exact" });
  return {
    displayRange: startYear === actualEndYear ? startLabel : `${startLabel}—${endLabel}`,
    range: { startYear, endYear }
  };
}

/**
 * 为全览模式生成可读分组及其标题年代范围。
 * 中国沿用既有历史阶段；多地区范围按顶层地区分组，跨地区实体只出现一次。
 */
export function buildOverviewTimelineGroups(
  data: CrownlineData,
  matches: MatchedEntity[],
  scope: RegionScope
): OverviewTimelineGroup[] {
  if (scope.mode === "china") {
    const matchesBySection = new Map<string, MatchedEntity[]>();
    matches.forEach((match) => {
      if (!match.section) return;
      const sectionMatches = matchesBySection.get(match.section.id) ?? [];
      sectionMatches.push(match);
      matchesBySection.set(match.section.id, sectionMatches);
    });
    return data.timelineSections.flatMap((section): OverviewTimelineGroup[] => {
      const sectionMatches = matchesBySection.get(section.id);
      return sectionMatches ? [{
        id: section.id,
        title: section.title,
        displayRange: section.displayRange,
        range: section.range,
        matches: sectionMatches,
        kind: "china-section"
      }] : [];
    });
  }

  const historicalRegions = data.regions.filter(({ regionKind }) => {
    return regionKind === "historical-region";
  });
  const regionById = new Map(historicalRegions.map((region) => [region.id, region]));
  const topLevelRegions = historicalRegions.filter(({ parentRegionId }) => !parentRegionId);
  const activeTopLevelIds = new Set(
    scope.mode === "global"
      ? topLevelRegions.map(({ id }) => id)
      : scope.regionIds.flatMap((regionId) => {
          const topLevelId = getTopLevelRegionId(regionId, regionById);
          return topLevelId ? [topLevelId] : [];
        })
  );
  const matchesByRegion = new Map<string, MatchedEntity[]>();
  const crossRegionMatches: MatchedEntity[] = [];

  matches.forEach((match) => {
    const matchingTopLevelIds = [...new Set(match.entity.historicalRegionIds.flatMap((regionId) => {
      const topLevelId = getTopLevelRegionId(regionId, regionById);
      return topLevelId && activeTopLevelIds.has(topLevelId) ? [topLevelId] : [];
    }))];
    if (matchingTopLevelIds.length > 1) {
      crossRegionMatches.push(match);
      return;
    }
    const regionId = matchingTopLevelIds[0];
    if (!regionId) return;
    const regionMatches = matchesByRegion.get(regionId) ?? [];
    regionMatches.push(match);
    matchesByRegion.set(regionId, regionMatches);
  });

  const groups: OverviewTimelineGroup[] = [];
  if (crossRegionMatches.length > 0) {
    const sortedMatches = sortMatches(crossRegionMatches);
    groups.push({
      id: "overview-cross-region",
      title: "跨地区政权",
      ...getGroupRange(sortedMatches),
      matches: sortedMatches,
      kind: "cross-region"
    });
  }
  topLevelRegions.forEach((region) => {
    const regionMatches = matchesByRegion.get(region.id);
    if (!regionMatches || regionMatches.length === 0) return;
    const sortedMatches = sortMatches(regionMatches);
    groups.push({
      id: `overview-region-${region.id}`,
      title: region.names.primary,
      ...getGroupRange(sortedMatches),
      matches: sortedMatches,
      regionId: region.id,
      kind: "region"
    });
  });
  return groups;
}
