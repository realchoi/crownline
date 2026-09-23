import type { MapLayer } from "./browseState";

/** 某个地图图层选择需要哪些数据包。 */
export interface MapLayerNeeds {
  points: boolean;
  boundaries: boolean;
}

export function getMapLayerNeeds(layer: MapLayer): MapLayerNeeds {
  return { points: layer !== "boundaries", boundaries: layer !== "points" };
}

/**
 * 按已就绪的数据确定实际可渲染的图层。
 * 组合图层中一方失败或仍在加载时，先渲染已就绪的一方；都未就绪时返回 null。
 */
export function resolveRenderableMapLayer(
  requested: MapLayer,
  ready: MapLayerNeeds
): MapLayer | null {
  const needs = getMapLayerNeeds(requested);
  const points = needs.points && ready.points;
  const boundaries = needs.boundaries && ready.boundaries;
  if (points && boundaries) return "combined";
  if (points) return "points";
  if (boundaries) return "boundaries";
  return null;
}
