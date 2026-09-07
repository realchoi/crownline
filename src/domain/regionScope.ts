import type { HistoricalEntity, Region } from "./types";

export const CHINA_REGION_ID = "region-china";

export type RegionScope =
  { mode: "china" } | { mode: "custom"; regionIds: string[] } | { mode: "global" };

/** 控制条与结果摘要共享的范围名称，长选择保留前两个地区与总数。 */
export function getRegionScopeLabel(scope: RegionScope, regions: Region[]): string {
  if (scope.mode === "china") return "中国";
  if (scope.mode === "global") return "全球已收录";
  const names = scope.regionIds.flatMap((regionId) => {
    const region = regions.find(({ id }) => id === regionId);
    return region ? [region.names.primary] : [];
  });
  return names.length > 2
    ? `${names.slice(0, 2).join("、")}等 ${names.length} 地区`
    : names.join("、");
}

/** 将选择的历史地区扩展为包含全部后代的稳定 ID 集合。 */
export function expandHistoricalRegionIds(regions: Region[], selectedIds: string[]): Set<string> {
  const expanded = new Set(selectedIds);
  let changed = true;
  while (changed) {
    changed = false;
    regions.forEach((region) => {
      if (
        region.regionKind === "historical-region" &&
        region.parentRegionId &&
        expanded.has(region.parentRegionId) &&
        !expanded.has(region.id)
      ) {
        expanded.add(region.id);
        changed = true;
      }
    });
  }
  return expanded;
}

/** 判断实体是否属于当前地区范围；多地区采用并集语义。 */
export function entityMatchesRegionScope(
  entity: HistoricalEntity,
  regions: Region[],
  scope: RegionScope
): boolean {
  if (scope.mode === "global") return true;
  const selectedIds = scope.mode === "china" ? [CHINA_REGION_ID] : scope.regionIds;
  const expandedIds = expandHistoricalRegionIds(regions, selectedIds);
  return entity.historicalRegionIds.some((regionId) => expandedIds.has(regionId));
}
