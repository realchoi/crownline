import { HistoricalMap } from "../components/HistoricalMap";
import { MapLoadPanel } from "../components/MapLoadPanel";
import { MapResultList } from "../components/MapResultList";
import { Timeline } from "../components/Timeline";
import { TimepointView } from "../components/TimepointView";
import type { BrowseState } from "../domain/browseState";
import type { MapSelection } from "../domain/mapSnapshots";
import type { BrowseResults } from "../domain/selectors";
import type { CrownlineIndex } from "../domain/types";
import type { GeographyState } from "./useGeographyData";

interface BrowseContentProps {
  data: CrownlineIndex;
  browseState: BrowseState;
  results: BrowseResults;
  geographyState: GeographyState;
  mapSelection: MapSelection | null;
  onRetryGeography: () => void;
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
  onRetryGeography,
  onSelect,
  onToggleComparison
}: BrowseContentProps) {
  if (browseState.viewMode === "map") {
    if (geographyState.status !== "ready" || !mapSelection) {
      return (
        <MapLoadPanel
          state={geographyState.status === "error" ? { error: geographyState.message } : "loading"}
          onRetry={onRetryGeography}
        />
      );
    }
    return (
      <section className="historical-map-shell" aria-label="历史地图浏览结果">
        {geographyState.result.omittedCount > 0 && (
          <p className="map-data-warning" role="status">
            有 {geographyState.result.omittedCount} 条地理记录格式异常，已跳过。
          </p>
        )}
        <HistoricalMap
          clusters={mapSelection.clusters}
          isOverview={browseState.mode === "overview"}
          onSelect={onSelect}
        />
        <MapResultList
          points={mapSelection.points}
          missingEntities={mapSelection.missingEntities}
          isOverview={browseState.mode === "overview"}
          comparisonEntityIds={browseState.compareEntityIds}
          onSelect={onSelect}
          onToggleComparison={onToggleComparison}
        />
      </section>
    );
  }

  if (browseState.mode === "overview") {
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
