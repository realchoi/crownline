import { useCallback, useEffect, useRef, useState } from "react";

import type { DetailLoadState } from "../components/DetailLoadPanel";
import type { CrownlineDetailLoader } from "../data/loadCrownlineDetail";

/** Isolates detail request lifecycles so closed or superseded requests cannot update the UI. */
export function useEntityDetail(
  entityId: string | null,
  detailEntityIds: string[],
  loadDetail: CrownlineDetailLoader
) {
  const [detailState, setDetailState] = useState<DetailLoadState>({ status: "missing" });
  const requestSequenceRef = useRef(0);

  const load = useCallback(
    (requestedEntityId: string) => {
      const requestSequence = ++requestSequenceRef.current;
      if (!detailEntityIds.includes(requestedEntityId)) {
        setDetailState({ status: "missing" });
        return;
      }

      setDetailState({ status: "loading" });
      void loadDetail(requestedEntityId)
        .then((detail) => {
          if (requestSequence !== requestSequenceRef.current) return;
          setDetailState(detail ? { status: "ready", detail } : { status: "missing" });
        })
        .catch((error: unknown) => {
          if (requestSequence !== requestSequenceRef.current) return;
          setDetailState({
            status: "error",
            message: error instanceof Error ? error.message : String(error)
          });
        });
    },
    [detailEntityIds, loadDetail]
  );

  useEffect(() => {
    if (!entityId) {
      requestSequenceRef.current += 1;
      setDetailState({ status: "missing" });
      return;
    }
    load(entityId);
  }, [entityId, load]);

  const retry = useCallback(() => {
    if (entityId) load(entityId);
  }, [entityId, load]);

  return { detailState, retry };
}
