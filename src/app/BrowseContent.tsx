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
    if (pointsRequired && (geographyState.status !== "ready" || !mapSelection)) {
      return (
        <MapLoadPanel
          kind="geography"
          state={geographyState.status === "error" ? { error: geographyState.message } : "loading"}
          onRetry={onRetryGeography}
        />
      );
    }
    if (boundariesRequired && (boundaryState.status !== "ready" || !boundarySelection)) {
      return (
        <MapLoadPanel
          kind="boundaries"
          state={boundaryState.status === "error" ? { error: boundaryState.message } : "loading"}
          onRetry={onRetryBoundaries}
        />
      );
    }
    const effectiveMapSelection = mapSelection ?? { points: [], clusters: [], missingEntities: [] };
    const effectiveBoundarySelection = boundarySelection ?? {
      boundaries: [],
      missingEntities: [],
      requiresYear: false
    };
    return (
      <section className="historical-map-shell" aria-label="历史地图浏览结果">
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
        <HistoricalMap
          clusters={effectiveMapSelection.clusters}
          boundaries={effectiveBoundarySelection.boundaries}
          mapLayer={browseState.mapLayer as MapLayer}
          isOverview={browseState.timeRange === "all"}
          comparisonEntityIds={browseState.compareEntityIds}
          selectedEntityId={browseState.detailEntityId}
          onSelect={onSelect}
        />
        <MapResultList
          points={effectiveMapSelection.points}
          boundaries={effectiveBoundarySelection.boundaries}
          missingEntities={
            browseState.mapLayer === "points"
              ? effectiveMapSelection.missingEntities
              : effectiveBoundarySelection.missingEntities
          }
          requiresBoundaryYear={effectiveBoundarySelection.requiresYear}
          mapLayer={browseState.mapLayer}
          isOverview={browseState.timeRange === "all"}
          comparisonEntityIds={browseState.compareEntityIds}
          onSelect={onSelect}
          onToggleComparison={onToggleComparison}
        />
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
