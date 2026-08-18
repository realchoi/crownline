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
      return;
    }

    const params = writeBrowseState(browseState, yearBounds, window.location.search);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    const detailChanged = detailHistoryRef.current !== browseState.detailEntityId;
    detailHistoryRef.current = browseState.detailEntityId;

    window.history[detailChanged ? "pushState" : "replaceState"](null, "", next);
  }, [browseState, yearBounds]);

  return { browseState, setBrowseState };
}
