import { useCallback, useEffect, useRef, useState } from "react";

import type { CrownlineGeographyLoader, GeographyLoadResult } from "../data/loadCrownlineGeography";
import type { ViewMode } from "../domain/browseState";

export type GeographyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: GeographyLoadResult }
  | { status: "error"; message: string };

/** Lazily loads and caches geography while isolating requests after leaving the map. */
export function useGeographyData(viewMode: ViewMode, loadGeography: CrownlineGeographyLoader) {
  const [geographyState, setGeographyState] = useState<GeographyState>({ status: "idle" });
  const requestSequenceRef = useRef(0);

  const retry = useCallback(() => {
    const requestSequence = ++requestSequenceRef.current;
    setGeographyState({ status: "loading" });
    void loadGeography()
      .then((result) => {
        if (requestSequence !== requestSequenceRef.current) return;
        setGeographyState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (requestSequence !== requestSequenceRef.current) return;
        setGeographyState({
          status: "error",
          message: error instanceof Error ? error.message : String(error)
        });
      });
  }, [loadGeography]);

  useEffect(() => {
    if (viewMode === "map" && geographyState.status === "idle") {
      retry();
      return;
    }
    if (viewMode === "timeline" && geographyState.status === "loading") {
      requestSequenceRef.current += 1;
      setGeographyState({ status: "idle" });
    }
  }, [geographyState.status, retry, viewMode]);

  return { geographyState, retry };
}
