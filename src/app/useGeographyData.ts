import type { CrownlineGeographyLoader, GeographyLoadResult } from "../data/loadCrownlineGeography";
import type { MapLayer, ViewMode } from "../domain/browseState";
import { getMapLayerNeeds } from "../domain/mapLayers";
import { useLazyResource, type LazyResourceState } from "./useLazyResource";

export type GeographyState = LazyResourceState<GeographyLoadResult>;

/** 只在地图启用点位或组合图层时加载地理数据。 */
export function useGeographyData(
  viewMode: ViewMode,
  mapLayer: MapLayer,
  loadGeography: CrownlineGeographyLoader
) {
  const enabled = viewMode === "map" && getMapLayerNeeds(mapLayer).points;
  const { state, retry } = useLazyResource(enabled, loadGeography);
  return { geographyState: state, retry };
}
