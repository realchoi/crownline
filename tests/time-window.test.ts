import { describe, expect, it } from "vitest";

import { buildTimelineAxis } from "../src/domain/timelineAxis";
import {
  formatTimeWindow,
  isPeriodInTimeWindow,
  listZoomSegments,
  sanitizeTimeWindow,
  zoomOutTimeWindow
} from "../src/domain/timeWindow";
import type { HistoricalInterval } from "../src/domain/types";

const bounds = { min: -2070, max: 1922 };

function period(start: number, end: number): HistoricalInterval {
  return {
    start: { year: start, precision: "exact" },
    end: { year: end, precision: "exact" }
  };
}

describe("时间窗口清洗", () => {
  it("接受数据范围内且不少于 10 年的窗口", () => {
    expect(sanitizeTimeWindow(500, 1000, bounds)).toEqual({ startYear: 500, endYear: 1000 });
  });

  it("把越界端点裁剪到数据范围", () => {
    expect(sanitizeTimeWindow(-3000, -1000, bounds)).toEqual({
      startYear: -2070,
      endYear: -1000
    });
  });

  it("拒绝公元 0 年、非整数和颠倒的端点", () => {
    expect(sanitizeTimeWindow(0, 100, bounds)).toBeNull();
    expect(sanitizeTimeWindow(1.5, 100, bounds)).toBeNull();
    expect(sanitizeTimeWindow(1000, 500, bounds)).toBeNull();
  });

  it("按连续序数计算最小跨度，前5 到 5 只有 9 个序数单位", () => {
    expect(sanitizeTimeWindow(-5, 5, bounds)).toBeNull();
    expect(sanitizeTimeWindow(-5, 6, bounds)).toEqual({ startYear: -5, endYear: 6 });
  });

  it("覆盖完整数据范围时视为未设置窗口", () => {
    expect(sanitizeTimeWindow(-2070, 1922, bounds)).toBeNull();
    expect(sanitizeTimeWindow(-2500, 2000, bounds)).toBeNull();
  });
});

describe("时间窗口命中", () => {
  it("区间两端均包含", () => {
    const window = { startYear: 500, endYear: 1000 };
    expect(isPeriodInTimeWindow(period(400, 500), window)).toBe(true);
    expect(isPeriodInTimeWindow(period(1000, 1100), window)).toBe(true);
    expect(isPeriodInTimeWindow(period(1001, 1100), window)).toBe(false);
    expect(isPeriodInTimeWindow(period(300, 499), window)).toBe(false);
  });

  it("跨越公元前后判断重叠", () => {
    expect(isPeriodInTimeWindow(period(-202, 8), { startYear: 1, endYear: 100 })).toBe(true);
    expect(isPeriodInTimeWindow(period(-202, -1), { startYear: 1, endYear: 100 })).toBe(false);
  });
});

describe("按刻度放大的分段", () => {
  it("以区间端点和刻度切分，并给出轨道百分比位置", () => {
    const range = { startYear: 400, endYear: 1000 };
    const segments = listZoomSegments(range, buildTimelineAxis(range));

    expect(segments.map(({ startYear, endYear }) => [startYear, endYear])).toEqual([
      [400, 500],
      [500, 600],
      [600, 700],
      [700, 800],
      [800, 900],
      [900, 1000]
    ]);
    expect(segments[0]?.left).toBe(0);
    expect(segments.at(-1)?.left).toBeCloseTo((500 / 600) * 100, 6);
    expect(segments.at(-1)?.width).toBeCloseTo((100 / 600) * 100, 6);
  });

  it("保留端点与首个刻度之间的边缘分段，舍弃不足 10 年的分段", () => {
    const range = { startYear: -2070, endYear: 1922 };
    const segments = listZoomSegments(range, buildTimelineAxis(range));

    expect(segments[0]).toMatchObject({ startYear: -2070, endYear: -2000 });
    expect(segments.at(-1)).toMatchObject({ startYear: 1500, endYear: 1922 });
    const tiny = listZoomSegments(
      { startYear: 995, endYear: 1100 },
      buildTimelineAxis({ startYear: 995, endYear: 1100 })
    );
    expect(tiny[0]).toMatchObject({ startYear: 1000 });
  });
});

describe("缩小时间窗口", () => {
  it("以窗口中心扩大到约 3 倍并对齐整数年代", () => {
    // 500—1000 扩为前1—1500，再按新范围的刻度间隔（200 年）向外取整。
    expect(zoomOutTimeWindow({ startYear: 500, endYear: 1000 }, bounds)).toEqual({
      startYear: -200,
      endYear: 1600
    });
  });

  it("贴近数据边界时整体平移而不越界", () => {
    expect(zoomOutTimeWindow({ startYear: 1800, endYear: 1900 }, bounds)).toEqual({
      startYear: 1600,
      endYear: 1922
    });
  });

  it("扩大后覆盖完整数据范围时回到未设置窗口", () => {
    expect(zoomOutTimeWindow({ startYear: -1000, endYear: 1000 }, bounds)).toBeNull();
  });
});

describe("时间窗口文案", () => {
  it("按中文纪年格式输出两端", () => {
    expect(formatTimeWindow({ startYear: -221, endYear: 220 })).toBe("前221—220");
  });
});
