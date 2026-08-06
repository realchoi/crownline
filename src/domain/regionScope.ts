import type { HistoricalEntity, Region } from "./types";

export const CHINA_REGION_ID = "region-china";

export type RegionScope =
  | { mode: "china" }
  | { mode: "custom"; regionIds: string[] }
  | { mode: "global" };

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
