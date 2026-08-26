import type { Dispatch, Ref, SetStateAction } from "react";

import { FilterPanel } from "../components/FilterPanel";
import { ViewModeControl } from "../components/ViewModeControl";
import {
  clearAdditionalFilters,
  selectBrowseYear,
  selectTimeRange,
  type BrowseState,
  type HistoricalYearBounds
} from "../domain/browseState";
import type { Region } from "../domain/types";

interface BrowseControlsProps {
  browseState: BrowseState;
  setBrowseState: Dispatch<SetStateAction<BrowseState>>;
  yearBounds: HistoricalYearBounds;
  regions: Region[];
  panelRef: Ref<HTMLElement>;
}

/** 一级呈现方式与探索控制区的页面级组合。 */
export function BrowseControls({
  browseState,
  setBrowseState,
  yearBounds,
  regions,
  panelRef
}: BrowseControlsProps) {
  return (
    <section className="exploration-controls" aria-label="探索控制区">
      <ViewModeControl
        value={browseState.viewMode}
        onChange={(viewMode) => setBrowseState((current) => ({ ...current, viewMode }))}
      />
      <FilterPanel
        panelRef={panelRef}
        viewMode={browseState.viewMode}
        mapLayer={browseState.mapLayer}
        timeRange={browseState.timeRange}
        year={browseState.year}
        yearBounds={yearBounds}
        query={browseState.query}
        category={browseState.category}
        regions={regions}
        regionScope={browseState.regionScope}
        onTimeRangeChange={(timeRange) =>
          setBrowseState((current) => selectTimeRange(current, timeRange))
        }
        onYearChange={(year) => setBrowseState((current) => selectBrowseYear(current, year))}
        onMapLayerChange={(mapLayer) => setBrowseState((current) => ({ ...current, mapLayer }))}
        onQueryChange={(query) => setBrowseState((current) => ({ ...current, query }))}
        onCategoryChange={(category) => setBrowseState((current) => ({ ...current, category }))}
        onRegionScopeChange={(regionScope) =>
          setBrowseState((current) => ({ ...current, regionScope }))
        }
        onClear={() => setBrowseState(clearAdditionalFilters)}
      />
    </section>
  );
}
