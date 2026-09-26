import type { ViewMode } from "../domain/browseState";

interface ViewModeControlProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  /** `tabs` 用于控制台首行，表现为统领下方结果区的页签；`switch` 为紧凑分段按钮。 */
  appearance?: "tabs" | "switch";
}

/** 切换一级呈现方式，不改变时间范围、观测范围或附加筛选。 */
export function ViewModeControl({ value, onChange, appearance = "switch" }: ViewModeControlProps) {
  return (
    <section className={`view-mode-control is-${appearance}`} aria-label="呈现方式">
      <span className="field-label">呈现方式</span>
      <div
        className={appearance === "tabs" ? "view-tabs" : "mode-switch"}
        role="group"
        aria-label="呈现方式选择"
      >
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
