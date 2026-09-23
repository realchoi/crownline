import { Timeline } from "../components/Timeline";
import { TimepointView } from "../components/TimepointView";
import type { BrowseState } from "../domain/browseState";
import type { BoundarySelection } from "../domain/boundarySnapshots";
import type { MapSelection } from "../domain/mapSnapshots";
import type { OverviewTimelineGroup } from "../domain/overviewTimeline";
import type { BrowseResults } from "../domain/selectors";
import type { CrownlineIndex } from "../domain/types";
import type { GeographyState } from "./useGeographyData";
import type { BoundaryState } from "./useBoundaryData";
import { MapBrowseView } from "./MapBrowseView";

interface BrowseContentProps {
  data: CrownlineIndex;
  browseState: BrowseState;
  results: BrowseResults;
  overviewGroups: OverviewTimelineGroup[];
  geographyState: GeographyState;
  mapSelection: MapSelection | null;
  boundaryState: BoundaryState;
  boundarySelection: BoundarySelection | null;
  onRetryGeography: () => void;
  onRetryBoundaries: () => void;
  onSelect: (entityId: string) => void;
  onToggleComparison: (entityId: string) => void;
}

/** Chooses the map, overview timeline, or timepoint result surface. */
export function BrowseContent({
  data,
  browseState,
  results,
  overviewGroups,
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
    return (
      <MapBrowseView
        browseState={browseState}
        geographyState={geographyState}
        mapSelection={mapSelection}
        boundaryState={boundaryState}
        boundarySelection={boundarySelection}
        onRetryGeography={onRetryGeography}
        onRetryBoundaries={onRetryBoundaries}
        onSelect={onSelect}
        onToggleComparison={onToggleComparison}
      />
    );
  }

  if (browseState.timeRange === "all") {
    return (
      <Timeline
        groups={overviewGroups}
        matchCount={results.all.length}
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
