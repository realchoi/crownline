import type { ViewMode } from "../domain/browseState";

interface ViewModeControlProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

/** 切换一级呈现方式，不改变时间范围、观测范围或附加筛选。 */
export function ViewModeControl({ value, onChange }: ViewModeControlProps) {
  return (
    <section className="view-mode-control" aria-label="呈现方式">
      <span className="field-label">呈现方式</span>
      <div className="mode-switch" role="group" aria-label="呈现方式选择">
        <button
          type="button"
          aria-pressed={value === "timeline"}
          onClick={() => onChange("timeline")}
        >
          时间轴
        </button>
        <button type="button" aria-pressed={value === "map"} onClick={() => onChange("map")}>
          地图
        </button>
      </div>
    </section>
  );
}
