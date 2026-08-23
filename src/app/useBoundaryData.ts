import { useCallback, useEffect, useRef, useState } from "react";

import type { MapLayer, ViewMode } from "../domain/browseState";
import type {
  BoundaryLoadResult,
  CrownlineBoundariesLoader
} from "../data/loadCrownlineBoundaries";

export type BoundaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: BoundaryLoadResult }
  | { status: "error"; message: string };

/** 只在地图启用疆域或组合图层时加载，并隔离离开图层后的迟到结果。 */
export function useBoundaryData(
  viewMode: ViewMode,
  mapLayer: MapLayer,
  loadBoundaries: CrownlineBoundariesLoader
) {
  const [boundaryState, setBoundaryState] = useState<BoundaryState>({ status: "idle" });
  const requestSequenceRef = useRef(0);
  const successfulRef = useRef<BoundaryLoadResult | null>(null);

  const retry = useCallback(() => {
    if (successfulRef.current) {
      setBoundaryState({ status: "ready", result: successfulRef.current });
      return;
    }
    const requestSequence = ++requestSequenceRef.current;
    setBoundaryState({ status: "loading" });
    void loadBoundaries()
      .then((result) => {
        if (requestSequence !== requestSequenceRef.current) return;
        successfulRef.current = result;
        setBoundaryState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (requestSequence !== requestSequenceRef.current) return;
        setBoundaryState({
          status: "error",
          message: error instanceof Error ? error.message : String(error)
        });
      });
  }, [loadBoundaries]);

  const enabled = viewMode === "map" && mapLayer !== "points";
  useEffect(() => {
    if (enabled && boundaryState.status === "idle") {
      retry();
      return;
    }
    if (!enabled && boundaryState.status === "loading") {
      requestSequenceRef.current += 1;
      if (successfulRef.current) {
        setBoundaryState({ status: "ready", result: successfulRef.current });
      } else {
        setBoundaryState({ status: "idle" });
      }
    }
  }, [boundaryState.status, enabled, retry]);

  return { boundaryState, retry };
}
