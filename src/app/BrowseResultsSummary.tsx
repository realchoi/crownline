import type { BrowseState } from "../domain/browseState";
import type { BoundarySelection } from "../domain/boundarySnapshots";
import { getBrowseResultsSummary } from "../domain/browseResultsSummary";
import type { MapSelection } from "../domain/mapSnapshots";

interface BrowseResultsSummaryProps {
  browseState: BrowseState;
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
    <div className="results-line" role="status" aria-atomic="true">
      <span>{summary.primary}</span>
      <span>{summary.secondary}</span>
    </div>
  );
}
