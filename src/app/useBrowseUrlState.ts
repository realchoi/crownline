import { useEffect, useRef, useState } from "react";

import {
  readBrowseState,
  writeBrowseState,
  type BrowseState,
  type HistoricalYearBounds
} from "../domain/browseState";
import type { HistoricalEntity, Region } from "../domain/types";

interface BrowseUrlStateOptions {
  yearBounds: HistoricalYearBounds;
  regions: Region[];
  entities: HistoricalEntity[];
}

/** Owns URL initialization, history semantics, and browser navigation for browse state. */
export function useBrowseUrlState({ yearBounds, regions, entities }: BrowseUrlStateOptions) {
  const [browseState, setBrowseState] = useState<BrowseState>(() =>
    readBrowseState(window.location.search, yearBounds, regions, entities)
  );
  const detailHistoryRef = useRef(browseState.detailEntityId);
  const comparisonHistoryRef = useRef(browseState.comparisonOpen);
  const skipUrlSyncRef = useRef(false);

  useEffect(() => {
    const onPopstate = () => {
      skipUrlSyncRef.current = true;
      setBrowseState(readBrowseState(window.location.search, yearBounds, regions, entities));
    };
    window.addEventListener("popstate", onPopstate);
    return () => window.removeEventListener("popstate", onPopstate);
  }, [entities, regions, yearBounds]);

  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      detailHistoryRef.current = browseState.detailEntityId;
      comparisonHistoryRef.current = browseState.comparisonOpen;
      return;
    }

    const params = writeBrowseState(browseState, yearBounds, window.location.search);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    const detailChanged = detailHistoryRef.current !== browseState.detailEntityId;
    const comparisonChanged = comparisonHistoryRef.current !== browseState.comparisonOpen;
    detailHistoryRef.current = browseState.detailEntityId;
    comparisonHistoryRef.current = browseState.comparisonOpen;

    window.history[detailChanged || comparisonChanged ? "pushState" : "replaceState"](
      null,
      "",
      next
    );
  }, [browseState, yearBounds]);

  return { browseState, setBrowseState };
}
