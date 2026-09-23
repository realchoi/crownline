import type {
  BoundaryLoadResult,
  CrownlineBoundariesLoader
} from "../data/loadCrownlineBoundaries";
import type { MapLayer, ViewMode } from "../domain/browseState";
import { getMapLayerNeeds } from "../domain/mapLayers";
import { useLazyResource, type LazyResourceState } from "./useLazyResource";

export type BoundaryState = LazyResourceState<BoundaryLoadResult>;

/** 只在地图启用疆域或组合图层时加载疆域数据。 */
export function useBoundaryData(
  viewMode: ViewMode,
  mapLayer: MapLayer,
  loadBoundaries: CrownlineBoundariesLoader
) {
  const enabled = viewMode === "map" && getMapLayerNeeds(mapLayer).boundaries;
  const { state, retry } = useLazyResource(enabled, loadBoundaries);
  return { boundaryState: state, retry };
}
