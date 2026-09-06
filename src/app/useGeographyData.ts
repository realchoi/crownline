import { useCallback, useEffect, useRef, useState } from "react";

import type { CrownlineGeographyLoader, GeographyLoadResult } from "../data/loadCrownlineGeography";
import type { MapLayer, ViewMode } from "../domain/browseState";

export type GeographyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: GeographyLoadResult }
  | { status: "error"; message: string };

/** 只在地图启用点位或组合图层时加载，并隔离离开图层后的迟到结果。 */
export function useGeographyData(
  viewMode: ViewMode,
  mapLayer: MapLayer,
  loadGeography: CrownlineGeographyLoader
) {
  const [geographyState, setGeographyState] = useState<GeographyState>({ status: "idle" });
  const requestSequenceRef = useRef(0);
  const successfulRef = useRef<GeographyLoadResult | null>(null);

  const retry = useCallback(() => {
    if (successfulRef.current) {
      setGeographyState({ status: "ready", result: successfulRef.current });
      return;
    }
    const requestSequence = ++requestSequenceRef.current;
    setGeographyState({ status: "loading" });
    void loadGeography()
      .then((result) => {
        if (requestSequence !== requestSequenceRef.current) return;
        successfulRef.current = result;
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

  const enabled = viewMode === "map" && mapLayer !== "boundaries";
  useEffect(() => {
    if (enabled && geographyState.status === "idle") {
      retry();
      return;
    }
    if (!enabled && geographyState.status === "loading") {
      requestSequenceRef.current += 1;
      if (successfulRef.current) {
        setGeographyState({ status: "ready", result: successfulRef.current });
      } else {
        setGeographyState({ status: "idle" });
      }
    }
  }, [enabled, geographyState.status, retry]);

  return { geographyState, retry };
}
