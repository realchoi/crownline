import type { BrowseState } from "../domain/browseState";
import type { BoundarySelection } from "../domain/boundarySnapshots";
import { getBrowseResultsSummary } from "../domain/browseResultsSummary";
import { formatHistoricalYear } from "../domain/chronology";
import { getRegionScopeLabel } from "../domain/regionScope";
import type { MapSelection } from "../domain/mapSnapshots";
import type { Region } from "../domain/types";

interface BrowseResultsSummaryProps {
  browseState: BrowseState;
  regions: Region[];
  resultCount: number;
  overviewTotal: number;
  overviewGroupCount: number;
  mapPolityCount: number;
  mapSelection: MapSelection | null;
  boundarySelection: BoundarySelection | null;
}

/** Announces the currently composed result set without owning browse state. */
export function BrowseResultsSummary({
  browseState,
  regions,
  resultCount,
  overviewTotal,
  overviewGroupCount,
  mapPolityCount,
  mapSelection,
  boundarySelection
}: BrowseResultsSummaryProps) {
  const summary = getBrowseResultsSummary({
    browseState,
    resultCount,
    overviewTotal,
    overviewGroupCount,
    mapPolityCount,
    mapSelection,
    boundarySelection
  });
  return (
    <div
      className={`results-line${browseState.viewMode === "timeline" ? " results-timeline" : ""}`}
      role="status"
      aria-atomic="true"
    >
      <span className="results-context">
        {getRegionScopeLabel(browseState.regionScope, regions)} ·{" "}
        {browseState.timeRange === "all"
          ? "全时期"
          : formatHistoricalYear({ year: browseState.year, precision: "exact" })}
      </span>
      <span>{summary.primary}</span>
      <span className="results-hint">{summary.secondary}</span>
    </div>
  );
}
