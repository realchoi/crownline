import { projectCoordinates, type MapPoint, type ProjectedCoordinates } from "./mapSnapshots";

/** 地图视野：中心点使用世界底图百分比坐标，zoom 为相对全球视图的放大倍数。 */
export interface MapViewport {
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface GeographicBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 8;
export const MAP_ZOOM_STEP = 1.5;

export const GLOBAL_MAP_VIEWPORT: MapViewport = { zoom: 1, centerX: 50, centerY: 50 };

/** 按大区浏览的快捷视野；范围只用于取景，不表示历史地区或疆域。 */
export const MAP_VIEWPORT_PRESETS = [
  { id: "global", label: "全球", bounds: { west: -180, east: 180, south: -90, north: 90 } },
  { id: "east-asia", label: "东亚", bounds: { west: 73, east: 146, south: 15, north: 54 } },
  {
    id: "south-southeast-asia",
    label: "南亚与东南亚",
    bounds: { west: 60, east: 125, south: -10, north: 35 }
  },
  {
    id: "west-asia-mediterranean",
    label: "西亚与地中海",
    bounds: { west: -10, east: 75, south: 12, north: 47 }
  },
  { id: "europe", label: "欧洲", bounds: { west: -12, east: 48, south: 35, north: 65 } },
  { id: "africa", label: "非洲", bounds: { west: -20, east: 52, south: -35, north: 37 } },
  { id: "americas", label: "美洲", bounds: { west: -125, east: -35, south: -40, north: 35 } }
] as const satisfies readonly { id: string; label: string; bounds: GeographicBounds }[];

export type MapViewportPresetId = (typeof MAP_VIEWPORT_PRESETS)[number]["id"];

/** 地图与结果列表共享的取景状态；手动缩放后不再对应任何快捷视野。 */
export interface MapViewState {
  viewport: MapViewport;
  presetId: MapViewportPresetId | null;
}

export const GLOBAL_MAP_VIEW_STATE: MapViewState = {
  viewport: GLOBAL_MAP_VIEWPORT,
  presetId: "global"
};

/** 把缩放限制在允许范围内，并让视野始终完整落在世界底图内。 */
export function clampViewport({ zoom, centerX, centerY }: MapViewport): MapViewport {
  const clampedZoom = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, zoom));
  const half = 50 / clampedZoom;
  return {
    zoom: clampedZoom,
    centerX: Math.min(100 - half, Math.max(half, centerX)),
    centerY: Math.min(100 - half, Math.max(half, centerY))
  };
}

/** 以完整容纳经纬度范围的最大倍数取景（底图保持 2:1）。 */
export function viewportFromBounds({ west, east, south, north }: GeographicBounds): MapViewport {
  const topLeft = projectCoordinates({ latitude: north, longitude: west });
  const bottomRight = projectCoordinates({ latitude: south, longitude: east });
  const width = bottomRight.xPercent - topLeft.xPercent;
  const height = bottomRight.yPercent - topLeft.yPercent;
  return clampViewport({
    zoom: Math.min(100 / width, 100 / height),
    centerX: (topLeft.xPercent + bottomRight.xPercent) / 2,
    centerY: (topLeft.yPercent + bottomRight.yPercent) / 2
  });
}

/** 围绕当前中心缩放。 */
export function zoomViewport(viewport: MapViewport, factor: number): MapViewport {
  return clampViewport({ ...viewport, zoom: viewport.zoom * factor });
}

/** 把世界底图坐标换算为当前视野内的百分比坐标。 */
export function projectToViewport(
  { xPercent, yPercent }: ProjectedCoordinates,
  { zoom, centerX, centerY }: MapViewport
): ProjectedCoordinates {
  const half = 50 / zoom;
  return {
    xPercent: (xPercent - (centerX - half)) * zoom,
    yPercent: (yPercent - (centerY - half)) * zoom
  };
}

function isInsideViewport({ xPercent, yPercent }: ProjectedCoordinates): boolean {
  return xPercent >= 0 && xPercent <= 100 && yPercent >= 0 && yPercent <= 100;
}

/** 返回落在视野内的点位，坐标已换算为视野百分比；视野外点位只留在等价结果列表中。 */
export function selectViewportPoints(
  points: readonly MapPoint[],
  viewport: MapViewport
): MapPoint[] {
  return points.flatMap((point) => {
    const projected = projectToViewport(point, viewport);
    return isInsideViewport(projected) ? [{ ...point, ...projected }] : [];
  });
}

/** 按当前视野把结果拆成视野内与视野外两组，各自保持输入顺序并保留底图坐标。 */
export function partitionPointsByViewport(
  points: readonly MapPoint[],
  viewport: MapViewport
): { inView: MapPoint[]; outOfView: MapPoint[] } {
  const inView: MapPoint[] = [];
  const outOfView: MapPoint[] = [];
  for (const point of points) {
    if (isInsideViewport(projectToViewport(point, viewport))) inView.push(point);
    else outOfView.push(point);
  }
  return { inView, outOfView };
}
