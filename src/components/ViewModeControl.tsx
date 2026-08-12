import type { ViewMode } from "../domain/browseState";

interface ViewModeControlProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

/** 切换一级时间轴与地图视图，不改变时间轴内部浏览模式。 */
export function ViewModeControl({ value, onChange }: ViewModeControlProps) {
  return (
    <section className="view-mode-control" aria-label="视图模式">
      <span className="field-label">视图</span>
      <div className="mode-switch" role="group" aria-label="视图模式">
        <button
          type="button"
          aria-pressed={value === "timeline"}
          onClick={() => onChange("timeline")}
        >
          时间轴
        </button>
        <button
          type="button"
          aria-pressed={value === "map"}
          onClick={() => onChange("map")}
        >
          地图
        </button>
      </div>
    </section>
  );
}
