import { isYearInPeriods } from "./chronology";
import type { GeoJsonMultiPolygon, GeographicBoundarySnapshot, HistoricalEntity } from "./types";

export interface BoundaryGeometryIssue {
  code: string;
  path: string;
  message: string;
}

export interface BoundaryMapShape {
  entity: HistoricalEntity;
  snapshot: GeographicBoundarySnapshot;
  paths: string[];
}

export interface BoundarySelection {
  boundaries: BoundaryMapShape[];
  missingEntities: HistoricalEntity[];
  requiresYear: boolean;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function samePosition(left: readonly number[], right: readonly number[]): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function orientation(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  return (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
}

function onSegment(a: readonly number[], b: readonly number[], point: readonly number[]): boolean {
  return (
    Math.min(a[0]!, b[0]!) <= point[0]! &&
    point[0]! <= Math.max(a[0]!, b[0]!) &&
    Math.min(a[1]!, b[1]!) <= point[1]! &&
    point[1]! <= Math.max(a[1]!, b[1]!)
  );
}

function segmentsIntersect(
  firstStart: readonly number[],
  firstEnd: readonly number[],
  secondStart: readonly number[],
  secondEnd: readonly number[]
): boolean {
  const first = [
    orientation(firstStart, firstEnd, secondStart),
    orientation(firstStart, firstEnd, secondEnd)
  ];
  const second = [
    orientation(secondStart, secondEnd, firstStart),
    orientation(secondStart, secondEnd, firstEnd)
  ];
  const epsilon = 1e-10;
  if (
    (Math.abs(first[0]!) < epsilon && onSegment(firstStart, firstEnd, secondStart)) ||
    (Math.abs(first[1]!) < epsilon && onSegment(firstStart, firstEnd, secondEnd)) ||
    (Math.abs(second[0]!) < epsilon && onSegment(secondStart, secondEnd, firstStart)) ||
    (Math.abs(second[1]!) < epsilon && onSegment(secondStart, secondEnd, firstEnd))
  ) {
    return true;
  }
  return first[0]! > 0 !== first[1]! > 0 && second[0]! > 0 !== second[1]! > 0;
}

function ringArea(ring: readonly (readonly number[])[]): number {
  return (
    ring.reduce((area, point, index) => {
      const next = ring[(index + 1) % ring.length]!;
      return area + point[0]! * next[1]! - next[0]! * point[1]!;
    }, 0) / 2
  );
}

function pointInRing(point: readonly number[], ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index]!;
    const prior = ring[previous]!;
    const crosses =
      current[1]! > point[1]! !== prior[1]! > point[1]! &&
      point[0]! <
        ((prior[0]! - current[0]!) * (point[1]! - current[1]!)) / (prior[1]! - current[1]!) +
          current[0]!;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** 严格检查 MultiPolygon 的坐标层级、闭合、有效面积和反经线限制。 */
export function validateBoundaryGeometry(
  geometry: unknown,
  path = "/geometry"
): BoundaryGeometryIssue[] {
  const issues: BoundaryGeometryIssue[] = [];
  if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) {
    return [{ code: "INVALID_BOUNDARY_GEOMETRY", path, message: "geometry 必须是对象" }];
  }
  const candidate = geometry as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== "MultiPolygon") {
    issues.push({
      code: "INVALID_BOUNDARY_GEOMETRY_TYPE",
      path: `${path}/type`,
      message: "疆域 geometry.type 必须严格等于 MultiPolygon"
    });
  }
  if (!Array.isArray(candidate.coordinates) || candidate.coordinates.length === 0) {
    return [
      ...issues,
      {
        code: "EMPTY_BOUNDARY_GEOMETRY",
        path: `${path}/coordinates`,
        message: "MultiPolygon 至少需要一个 polygon"
      }
    ];
  }

  candidate.coordinates.forEach((polygon, polygonIndex) => {
    const polygonPath = `${path}/coordinates/${polygonIndex}`;
    if (!Array.isArray(polygon) || polygon.length === 0) {
      issues.push({
        code: "EMPTY_BOUNDARY_POLYGON",
        path: polygonPath,
        message: "polygon 至少需要一个线性环"
      });
      return;
    }
    const rings: number[][][] = [];
    polygon.forEach((ring, ringIndex) => {
      const ringPath = `${polygonPath}/${ringIndex}`;
      if (!Array.isArray(ring) || ring.length < 4) {
        issues.push({
          code: "INVALID_BOUNDARY_RING",
          path: ringPath,
          message: "线性环至少需要 4 个位置"
        });
        return;
      }
      const positions: number[][] = [];
      ring.forEach((position, positionIndex) => {
        const positionPath = `${ringPath}/${positionIndex}`;
        if (
          !Array.isArray(position) ||
          position.length !== 2 ||
          !isFiniteCoordinate(position[0]) ||
          !isFiniteCoordinate(position[1])
        ) {
          issues.push({
            code: "INVALID_BOUNDARY_POSITION",
            path: positionPath,
            message: "位置必须是有限数字 [longitude, latitude]"
          });
          return;
        }
        const [longitude, latitude] = position;
        if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          issues.push({
            code: "BOUNDARY_COORDINATE_OUT_OF_RANGE",
            path: positionPath,
            message: "经度必须在 -180—180，纬度必须在 -90—90"
          });
        }
        positions.push([longitude, latitude]);
      });
      if (positions.length < 4) return;
      if (!samePosition(positions[0]!, positions.at(-1)!)) {
        issues.push({
          code: "UNCLOSED_BOUNDARY_RING",
          path: ringPath,
          message: "线性环的首尾位置必须完全相同"
        });
      }
      for (let index = 1; index < positions.length; index += 1) {
        if (samePosition(positions[index - 1]!, positions[index]!)) {
          issues.push({
            code: "DUPLICATE_BOUNDARY_POSITION",
            path: `${ringPath}/${index}`,
            message: "线性环不允许连续重复坐标"
          });
        }
      }
      const longitudes = positions.map(([longitude]) => longitude!);
      if (Math.max(...longitudes) - Math.min(...longitudes) > 180) {
        issues.push({
          code: "ANTIMERIDIAN_BOUNDARY",
          path: ringPath,
          message: "试点疆域不得跨越反经线；请先拆分为预处理后的几何"
        });
      }
      if (Math.abs(ringArea(positions)) < 1e-8) {
        issues.push({
          code: "DEGENERATE_BOUNDARY_RING",
          path: ringPath,
          message: "线性环近似面积必须非零"
        });
      }
      const segmentCount = positions.length - 1;
      for (let first = 0; first < segmentCount; first += 1) {
        for (let second = first + 1; second < segmentCount; second += 1) {
          if (second === first + 1 || (first === 0 && second === segmentCount - 1)) continue;
          if (
            segmentsIntersect(
              positions[first]!,
              positions[first + 1]!,
              positions[second]!,
              positions[second + 1]!
            )
          ) {
            issues.push({
              code: "SELF_INTERSECTING_BOUNDARY_RING",
              path: `${ringPath}/${first}`,
              message: "线性环不能自相交"
            });
            break;
          }
        }
      }
      rings.push(positions);
    });
    const outer = rings[0];
    if (!outer) return;
    rings.slice(1).forEach((hole, holeIndex) => {
      if (!pointInRing(hole[0]!, outer)) {
        issues.push({
          code: "BOUNDARY_HOLE_OUTSIDE",
          path: `${polygonPath}/${holeIndex + 1}`,
          message: "洞环必须位于对应 polygon 的外环内"
        });
      }
    });
  });
  return issues;
}

function formatPathNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

function projectPosition(position: readonly number[]): [number, number] {
  return [position[0]! + 180, 90 - position[1]!];
}

/** 使用与点位相同的等距圆柱语义生成稳定 SVG path；每个 polygon 保留洞环。 */
export function projectMultiPolygonToSvgPaths(geometry: GeoJsonMultiPolygon): string[] {
  return geometry.coordinates.map((polygon) => {
    return polygon
      .map((ring) => {
        const commands = ring.map((position, index) => {
          const [x, y] = projectPosition(position);
          return `${index === 0 ? "M" : "L"}${formatPathNumber(x)} ${formatPathNumber(y)}`;
        });
        return `${commands.join(" ")} Z`;
      })
      .join(" ");
  });
}

function compareEntities(left: HistoricalEntity, right: HistoricalEntity): number {
  return left.id.localeCompare(right.id);
}

function compareBoundaries(left: BoundaryMapShape, right: BoundaryMapShape): number {
  return (
    left.entity.id.localeCompare(right.entity.id) ||
    left.snapshot.id.localeCompare(right.snapshot.id)
  );
}

/** 只选择指定年份有效的采用快照；没有年份时明确返回空疆域而不是跨时代合集。 */
export function selectBoundarySnapshots(
  polities: readonly HistoricalEntity[],
  snapshots: readonly GeographicBoundarySnapshot[],
  year?: number
): BoundarySelection {
  if (year === 0) throw new Error("疆域选择不支持公元 0 年");
  const polityById = new Map(
    polities
      .filter(({ entityKind }) => entityKind === "polity")
      .map((entity) => [entity.id, entity])
  );
  const sortedPolities = [...polityById.values()].sort(compareEntities);
  if (year === undefined) {
    return { boundaries: [], missingEntities: sortedPolities, requiresYear: true };
  }
  const matchesByPolity = new Map<string, GeographicBoundarySnapshot[]>();
  snapshots.forEach((snapshot) => {
    if (!polityById.has(snapshot.polityId) || !isYearInPeriods(year, snapshot.periods)) return;
    const matches = matchesByPolity.get(snapshot.polityId) ?? [];
    matches.push(snapshot);
    matchesByPolity.set(snapshot.polityId, matches);
  });
  const boundaries: BoundaryMapShape[] = [];
  const missingEntities: HistoricalEntity[] = [];
  sortedPolities.forEach((entity) => {
    const matches = (matchesByPolity.get(entity.id) ?? []).sort((left, right) =>
      left.id.localeCompare(right.id)
    );
    if (matches.length > 1) {
      throw new Error(`政权 ${entity.id} 在 ${year} 年命中多套采用疆域快照`);
    }
    const snapshot = matches[0];
    if (!snapshot) missingEntities.push(entity);
    else
      boundaries.push({
        entity,
        snapshot,
        paths: projectMultiPolygonToSvgPaths(snapshot.geometry)
      });
  });
  return {
    boundaries: boundaries.sort(compareBoundaries),
    missingEntities,
    requiresYear: false
  };
}
