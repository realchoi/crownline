import { HistoricalMap } from "../components/HistoricalMap";
import { MapLoadPanel } from "../components/MapLoadPanel";
import { MapResultList } from "../components/MapResultList";
import { Timeline } from "../components/Timeline";
import { TimepointView } from "../components/TimepointView";
import type { BrowseState } from "../domain/browseState";
import type { MapLayer } from "../domain/browseState";
import type { BoundarySelection } from "../domain/boundarySnapshots";
import type { MapSelection } from "../domain/mapSnapshots";
import type { BrowseResults } from "../domain/selectors";
import type { CrownlineIndex } from "../domain/types";
import type { GeographyState } from "./useGeographyData";
import type { BoundaryState } from "./useBoundaryData";

interface BrowseContentProps {
  data: CrownlineIndex;
  browseState: BrowseState;
  results: BrowseResults;
  geographyState: GeographyState;
  mapSelection: MapSelection | null;
  boundaryState: BoundaryState;
  boundarySelection: BoundarySelection | null;
  onRetryGeography: () => void;
  onRetryBoundaries: () => void;
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
  onToggleComparison: (entityId: string) => void;
}

/** Chooses the map, overview timeline, or timepoint result surface. */
export function BrowseContent({
  data,
  browseState,
  results,
  geographyState,
  mapSelection,
  boundaryState,
  boundarySelection,
  onRetryGeography,
  onRetryBoundaries,
  onSelect,
  onToggleComparison
}: BrowseContentProps) {
  if (browseState.viewMode === "map") {
    const pointsRequired = browseState.mapLayer !== "boundaries";
    const boundariesRequired = browseState.mapLayer !== "points";
    const pointsReady =
      pointsRequired && geographyState.status === "ready" && mapSelection !== null;
    const boundariesReady =
      boundariesRequired && boundaryState.status === "ready" && boundarySelection !== null;
    const availableMapLayer: MapLayer | null =
      pointsReady && boundariesReady
        ? "combined"
        : pointsReady
          ? "points"
          : boundariesReady
            ? "boundaries"
            : null;
    const effectiveMapSelection = mapSelection ?? { points: [], clusters: [], missingEntities: [] };
    const effectiveBoundarySelection = boundarySelection ?? {
      boundaries: [],
      missingEntities: [],
      requiresYear: false
    };
    return (
      <section className="historical-map-shell" aria-label="历史地图浏览结果">
        {((pointsRequired && !pointsReady) || (boundariesRequired && !boundariesReady)) && (
          <section className="map-layer-status-list" aria-label="地图图层状态">
            {pointsRequired && !pointsReady && (
              <MapLoadPanel
                kind="geography"
                state={
                  geographyState.status === "error" ? { error: geographyState.message } : "loading"
                }
                onRetry={onRetryGeography}
              />
            )}
            {boundariesRequired && !boundariesReady && (
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
        {pointsRequired &&
          geographyState.status === "ready" &&
          geographyState.result.omittedCount > 0 && (
            <p className="map-data-warning" role="status">
              有 {geographyState.result.omittedCount} 条地理记录格式异常，已跳过。
            </p>
          )}
        {boundariesRequired &&
          boundaryState.status === "ready" &&
          boundaryState.result.omittedCount > 0 && (
            <p className="map-data-warning" role="status">
              有 {boundaryState.result.omittedCount} 条疆域记录格式异常，已跳过。
            </p>
          )}
        {availableMapLayer && (
          <>
            <HistoricalMap
              clusters={availableMapLayer === "boundaries" ? [] : effectiveMapSelection.clusters}
              boundaries={
                availableMapLayer === "points" ? [] : effectiveBoundarySelection.boundaries
              }
              mapLayer={availableMapLayer}
              isOverview={browseState.timeRange === "all"}
              comparisonEntityIds={browseState.compareEntityIds}
              selectedEntityId={browseState.detailEntityId}
              onSelect={onSelect}
            />
            <MapResultList
              points={availableMapLayer === "boundaries" ? [] : effectiveMapSelection.points}
              boundaries={
                availableMapLayer === "points" ? [] : effectiveBoundarySelection.boundaries
              }
              missingEntities={
                availableMapLayer === "points"
                  ? effectiveMapSelection.missingEntities
                  : effectiveBoundarySelection.missingEntities
              }
              requiresBoundaryYear={
                availableMapLayer === "points" ? false : effectiveBoundarySelection.requiresYear
              }
              mapLayer={availableMapLayer}
              isOverview={browseState.timeRange === "all"}
              comparisonEntityIds={browseState.compareEntityIds}
              onSelect={onSelect}
              onToggleComparison={onToggleComparison}
            />
          </>
        )}
      </section>
    );
  }

  if (browseState.timeRange === "all") {
    return (
      <Timeline
        data={data}
        matches={results.all}
        regions={data.regions}
        regionScope={browseState.regionScope}
        emptyReason={results.polityEmptyReason}
        comparisonEntityIds={browseState.compareEntityIds}
        onToggleComparison={onToggleComparison}
        onSelect={onSelect}
      />
    );
  }

  return (
    <TimepointView
      year={browseState.year}
      polities={results.polities}
      historicalPeriods={results.historicalPeriods}
      regions={data.regions}
      regionScope={browseState.regionScope}
      polityEmptyReason={results.polityEmptyReason}
      comparisonEntityIds={browseState.compareEntityIds}
      onToggleComparison={onToggleComparison}
      onSelect={onSelect}
    />
  );
}
