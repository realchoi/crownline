import { describe, expect, it } from "vitest";

import { buildTimelineAxis } from "../src/domain/timelineAxis";

describe("时间轴刻度", () => {
  it("全球全览选取每 500 年一格的整数刻度", () => {
    const axis = buildTimelineAxis({ startYear: -2070, endYear: 1922 });

    expect(axis.step).toBe(500);
    expect(axis.ticks.map(({ year }) => year)).toEqual([
      -2000, -1500, -1000, -500, 1, 500, 1000, 1500
    ]);
  });

  it("跨越公元前后时用公元 1 年代替不存在的公元 0 年", () => {
    const axis = buildTimelineAxis({ startYear: -120, endYear: 120 });

    expect(axis.step).toBe(50);
    expect(axis.ticks.map(({ year }) => year)).toEqual([-100, -50, 1, 50, 100]);
  });

  it("刻度数量不超过上限", () => {
    const axis = buildTimelineAxis({ startYear: -770, endYear: -476 }, 4);

    expect(axis.step).toBe(100);
    expect(axis.ticks.map(({ year }) => year)).toEqual([-700, -600, -500]);
  });

  it("按连续序数换算刻度在轨道上的百分比位置", () => {
    const axis = buildTimelineAxis({ startYear: -100, endYear: 100 });
    const positions = new Map(axis.ticks.map(({ year, position }) => [year, position]));

    expect(positions.get(-100)).toBe(0);
    expect(positions.get(100)).toBe(100);
    // 前100 到 100 共 199 个序数单位，公元 1 年位于第 100 个单位。
    expect(positions.get(1)).toBeCloseTo((100 / 199) * 100, 6);
  });

  it("包含落在区间端点上的刻度", () => {
    const axis = buildTimelineAxis({ startYear: 500, endYear: 1000 });

    expect(axis.ticks[0]).toEqual({ year: 500, position: 0 });
    expect(axis.ticks.at(-1)).toEqual({ year: 1000, position: 100 });
  });

  it("单年区间不生成刻度", () => {
    expect(buildTimelineAxis({ startYear: 221, endYear: 221 }).ticks).toEqual([]);
  });
});
