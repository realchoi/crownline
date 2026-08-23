export type MapLoadPanelState = "loading" | { error: string };
export type MapLoadPanelKind = "geography" | "boundaries";

interface MapLoadPanelProps {
  kind?: MapLoadPanelKind;
  state: MapLoadPanelState;
  onRetry: () => void;
}

/** 呈现地图地理数据的加载与失败重试状态。 */
export function MapLoadPanel({ kind = "geography", state, onRetry }: MapLoadPanelProps) {
  const label = kind === "boundaries" ? "疆域" : "地理";
  if (state === "loading") {
    return (
      <section className="map-load-panel" role="status">
        <p>正在加载{label}数据…</p>
      </section>
    );
  }

  return (
    <section className="map-load-panel map-load-error" role="alert">
      <strong>无法加载{label}数据</strong>
      <p>{state.error}</p>
      <button className="button" type="button" onClick={onRetry}>
        重试
      </button>
    </section>
  );
}
