export type MapLoadPanelState = "loading" | { error: string };

interface MapLoadPanelProps {
  state: MapLoadPanelState;
  onRetry: () => void;
}

/** 呈现地图地理数据的加载与失败重试状态。 */
export function MapLoadPanel({ state, onRetry }: MapLoadPanelProps) {
  if (state === "loading") {
    return (
      <section className="map-load-panel" role="status">
        <p>正在加载地理数据…</p>
      </section>
    );
  }

  return (
    <section className="map-load-panel map-load-error" role="alert">
      <strong>无法加载地理数据</strong>
      <p>{state.error}</p>
      <button className="button" type="button" onClick={onRetry}>
        重试
      </button>
    </section>
  );
}
