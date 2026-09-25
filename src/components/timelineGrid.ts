import type { CSSProperties } from "react";

import type { TimelineAxis } from "../domain/timelineAxis";

/** 生成与刻度对齐的轨道网格线，经 CSS 变量传给分组内所有轨道。 */
export function timelineGridStyle(axis: TimelineAxis): CSSProperties {
  if (axis.ticks.length === 0) return {};
  const stops = axis.ticks.flatMap(({ position }) => {
    const at = position.toFixed(3);
    return [
      `transparent calc(${at}% - 0.5px)`,
      `var(--track-grid) calc(${at}% - 0.5px)`,
      `var(--track-grid) calc(${at}% + 0.5px)`,
      `transparent calc(${at}% + 0.5px)`
    ];
  });
  return { "--timeline-grid": `linear-gradient(to right, ${stops.join(", ")})` } as CSSProperties;
}
