import { isYearInPeriods } from "./chronology";
import type {
  GeographicCoordinates,
  GeographicRole,
  GeographicSnapshot,
  HistoricalEntity
} from "./types";

export const MAP_CLUSTER_DISTANCE_PERCENT = 4;

export const GEOGRAPHIC_ROLE_NAMES: Record<GeographicRole, string> = {
  capital: "都城",
  "political-center": "政治中心",
  "representative-center": "代表性中心"
};

export interface ProjectedCoordinates {
  xPercent: number;
  yPercent: number;
}

export interface MapPoint extends ProjectedCoordinates {
  entity: HistoricalEntity;
  snapshot: GeographicSnapshot;
}

export interface MapCluster extends ProjectedCoordinates {
  id: string;
  points: MapPoint[];
}

export interface MapSelection {
  points: MapPoint[];
  clusters: MapCluster[];
  missingEntities: HistoricalEntity[];
}

/** 使用等距圆柱投影把 WGS 84 坐标映射为底图百分比位置。 */
export function projectCoordinates({
  latitude,
  longitude
}: GeographicCoordinates): ProjectedCoordinates {
  return {
    xPercent: ((longitude + 180) / 360) * 100,
    yPercent: ((90 - latitude) / 180) * 100
  };
}

function compareMapPoints(left: MapPoint, right: MapPoint): number {
  return left.xPercent - right.xPercent ||
    left.yPercent - right.yPercent ||
    left.entity.id.localeCompare(right.entity.id) ||
    left.snapshot.id.localeCompare(right.snapshot.id);
}

/** 按投影距离生成与输入顺序无关的稳定聚合组。 */
export function clusterMapPoints(
  points: readonly MapPoint[],
  thresholdPercent = MAP_CLUSTER_DISTANCE_PERCENT
): MapCluster[] {
  const sortedPoints = [...points].sort(compareMapPoints);
  const groups: Array<{ anchor: MapPoint; points: MapPoint[] }> = [];

  sortedPoints.forEach((point) => {
    const group = groups.find(({ anchor }) => {
      return Math.hypot(
        point.xPercent - anchor.xPercent,
        point.yPercent - anchor.yPercent
      ) <= thresholdPercent;
    });
    if (group) group.points.push(point);
    else groups.push({ anchor: point, points: [point] });
  });

  return groups.map(({ anchor, points: groupedPoints }) => ({
    id: `map-cluster:${groupedPoints
      .map(({ snapshot }) => snapshot.id)
      .sort((left, right) => left.localeCompare(right))
      .join("+")}`,
    xPercent: anchor.xPercent,
    yPercent: anchor.yPercent,
    points: groupedPoints
  }));
}

/** 为已经过浏览筛选的真实政权选择指定年份的有效地理快照。 */
export function selectMapSnapshots(
  polities: readonly HistoricalEntity[],
  snapshots: readonly GeographicSnapshot[],
  year: number
): MapSelection {
  const polityById = new Map(
    polities
      .filter(({ entityKind }) => entityKind === "polity")
      .map((entity) => [entity.id, entity])
  );
  const points = snapshots
    .flatMap((snapshot): MapPoint[] => {
      const entity = polityById.get(snapshot.polityId);
      if (!entity || !isYearInPeriods(year, snapshot.periods)) return [];
      return [{ entity, snapshot, ...projectCoordinates(snapshot.coordinates) }];
    })
    .sort(compareMapPoints);
  const mappedEntityIds = new Set(points.map(({ entity }) => entity.id));
  const missingEntities = [...polityById.values()]
    .filter(({ id }) => !mappedEntityIds.has(id))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    points,
    clusters: clusterMapPoints(points),
    missingEntities
  };
}
