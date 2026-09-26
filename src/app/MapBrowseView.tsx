import { useRef, useState } from "react";

import { HistoricalMap } from "../components/HistoricalMap";
import { MapLayerControl } from "../components/MapLayerControl";
import { MapLoadPanel } from "../components/MapLoadPanel";
import { MapResultList } from "../components/MapResultList";
import type { BoundarySelection } from "../domain/boundarySnapshots";
import type { BrowseState } from "../domain/browseState";
import { getMapLayerNeeds, resolveRenderableMapLayer } from "../domain/mapLayers";
import type { MapSelection } from "../domain/mapSnapshots";
import { GLOBAL_MAP_VIEW_STATE, type MapViewState } from "../domain/mapViewport";
import type { BoundaryState } from "./useBoundaryData";
import type { GeographyState } from "./useGeographyData";

export interface MapBrowseViewProps {
  browseState: BrowseState;
  /** 生产疆域为零时不提供图层开关。 */
  boundariesAvailable: boolean;
  onMapLayerChange: (layer: BrowseState["mapLayer"]) => void;
  geographyState: GeographyState;
  mapSelection: MapSelection | null;
  boundaryState: BoundaryState;
  boundarySelection: BoundarySelection | null;
  onRetryGeography: () => void;
  onRetryBoundaries: () => void;
  onSelect: (entityId: string) => void;
  onToggleComparison: (entityId: string) => void;
}

const EMPTY_MAP_SELECTION: MapSelection = { points: [], missingEntities: [] };
const EMPTY_BOUNDARY_SELECTION: BoundarySelection = {
  boundaries: [],
  missingEntities: [],
  requiresYear: false
};

/** 地图呈现：按图层加载状态显示加载/错误面板、地图和等价结果列表。 */
export function MapBrowseView({
  browseState,
  boundariesAvailable,
  onMapLayerChange,
  geographyState,
  mapSelection,
  boundaryState,
  boundarySelection,
  onRetryGeography,
  onRetryBoundaries,
  onSelect,
  onToggleComparison
}: MapBrowseViewProps) {
  const needs = getMapLayerNeeds(browseState.mapLayer);
  const readyPoints = geographyState.status === "ready" ? mapSelection : null;
  const readyBoundaries = boundaryState.status === "ready" ? boundarySelection : null;
  const layer = resolveRenderableMapLayer(browseState.mapLayer, {
    points: readyPoints !== null,
    boundaries: readyBoundaries !== null
  });
  const showsPoints = layer === "points" || layer === "combined";
  const showsBoundaries = layer === "boundaries" || layer === "combined";
  const points = (showsPoints && readyPoints) || EMPTY_MAP_SELECTION;
  const boundaries = (showsBoundaries && readyBoundaries) || EMPTY_BOUNDARY_SELECTION;
  const pointsPending = needs.points && readyPoints === null;
  const boundariesPending = needs.boundaries && readyBoundaries === null;
  const isOverview = browseState.timeRange === "all";
  const [mapView, setMapView] = useState<MapViewState>(GLOBAL_MAP_VIEW_STATE);
  const resultListRef = useRef<HTMLElement>(null);
  // 结果列表中悬停或聚焦的点位，在地图上高亮其标记或所在聚合。
  const [highlightedPointId, setHighlightedPointId] = useState<string | null>(null);
  const changeMapView = (view: MapViewState) => {
    setMapView(view);
    // 换取景后视野内分组排在最前，列表回到顶部才能看到它。
    if (resultListRef.current) resultListRef.current.scrollTop = 0;
  };

  return (
    <section className="historical-map-shell" aria-label="历史地图浏览结果">
      {boundariesAvailable && (
        <MapLayerControl value={browseState.mapLayer} onChange={onMapLayerChange} />
      )}
      {(pointsPending || boundariesPending) && (
        <section className="map-layer-status-list" aria-label="地图图层状态">
          {pointsPending && (
            <MapLoadPanel
              kind="geography"
              state={
                geographyState.status === "error" ? { error: geographyState.message } : "loading"
              }
              onRetry={onRetryGeography}
            />
          )}
          {boundariesPending && (
            <MapLoadPanel
              kind="boundaries"
              state={
                boundaryState.status === "error" ? { error: boundaryState.message } : "loading"
              }
              onRetry={onRetryBoundaries}
            />
          )}
        </section>
      )}
      {needs.points &&
        geographyState.status === "ready" &&
        geographyState.result.omittedCount > 0 && (
          <p className="map-data-warning" role="status">
            有 {geographyState.result.omittedCount} 条地理记录格式异常，已跳过。
          </p>
        )}
      {needs.boundaries &&
        boundaryState.status === "ready" &&
        boundaryState.result.omittedCount > 0 && (
          <p className="map-data-warning" role="status">
            有 {boundaryState.result.omittedCount} 条疆域记录格式异常，已跳过。
          </p>
        )}
      {layer && (
        <>
          <HistoricalMap
            points={points.points}
            boundaries={boundaries.boundaries}
            mapLayer={layer}
            isOverview={isOverview}
            comparisonEntityIds={browseState.compareEntityIds}
            selectedEntityId={browseState.detailEntityId}
            view={mapView}
            onViewChange={changeMapView}
            highlightedPointId={highlightedPointId}
            onSelect={onSelect}
          />
          <MapResultList
            points={points.points}
            boundaries={boundaries.boundaries}
            missingEntities={showsBoundaries ? boundaries.missingEntities : points.missingEntities}
            requiresBoundaryYear={boundaries.requiresYear}
            mapLayer={layer}
            isOverview={isOverview}
            comparisonEntityIds={browseState.compareEntityIds}
            viewport={mapView.viewport}
            ref={resultListRef}
            onHighlightPoint={setHighlightedPointId}
            onSelect={onSelect}
            onToggleComparison={onToggleComparison}
          />
        </>
      )}
    </section>
  );
}
