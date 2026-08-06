import { describe, expect, it } from "vitest";

import {
  calculatePeriodsDuration,
  formatHistoricalYear,
  formatPeriods,
  fromOrdinal,
  isYearInPeriods,
  nextHistoricalYear,
  parseHistoricalYear,
  previousHistoricalYear,
  toOrdinal
} from "../src/domain/chronology";
import type { HistoricalInterval } from "../src/domain/types";

const westernQinPeriods: HistoricalInterval[] = [
  {
    start: { year: 385, precision: "exact" },
    end: { year: 400, precision: "exact" }
  },
  {
    start: { year: 409, precision: "exact" },
    end: { year: 431, precision: "exact" }
  }
];

describe("历史年份序数", () => {
  it("拒绝不存在的公元 0 年和非整数年份", () => {
    expect(() => toOrdinal(0)).toThrow("历史年份不存在公元 0 年");
    expect(() => toOrdinal(1.5)).toThrow("历史年份必须是整数");
  });

  it("让公元前 1 年与公元 1 年保持连续", () => {
    expect(toOrdinal(-2)).toBe(-1);
    expect(toOrdinal(-1)).toBe(0);
    expect(toOrdinal(1)).toBe(1);
    expect(fromOrdinal(0)).toBe(-1);
    expect(fromOrdinal(1)).toBe(1);
    expect(nextHistoricalYear(-1)).toBe(1);
    expect(previousHistoricalYear(1)).toBe(-1);
  });
});

describe("多段存在区间", () => {
  it("在闭区间端点存在，但在中断期不存在", () => {
    expect(isYearInPeriods(385, westernQinPeriods)).toBe(true);
    expect(isYearInPeriods(400, westernQinPeriods)).toBe(true);
    expect(isYearInPeriods(405, westernQinPeriods)).toBe(false);
    expect(isYearInPeriods(409, westernQinPeriods)).toBe(true);
    expect(isYearInPeriods(431, westernQinPeriods)).toBe(true);
  });

  it("按各段之和计算时长，不把中断期算入", () => {
    expect(calculatePeriodsDuration(westernQinPeriods)).toBe(39);
    expect(
      calculatePeriodsDuration([
        {
          start: { year: -1, precision: "exact" },
          end: { year: 1, precision: "exact" }
        }
      ])
    ).toBe(2);
  });
});

describe("传统纪年显示", () => {
  it("解析常见公元前写法并拒绝公元 0 年和小数", () => {
    expect(parseHistoricalYear("前221")).toBe(-221);
    expect(parseHistoricalYear("公元前 221")).toBe(-221);
    expect(parseHistoricalYear("-221")).toBe(-221);
    expect(parseHistoricalYear("公元 221")).toBe(221);
    expect(parseHistoricalYear("0")).toBeNull();
    expect(parseHistoricalYear("1.5")).toBeNull();
    expect(parseHistoricalYear("前")).toBeNull();
  });

  it("格式化公元前、公元后和约年", () => {
    expect(formatHistoricalYear({ year: -221, precision: "exact" })).toBe("前221");
    expect(formatHistoricalYear({ year: -2070, precision: "circa" })).toBe("约前2070");
    expect(formatHistoricalYear({ year: 8, precision: "exact" })).toBe("8");
  });

  it("格式化多段区间并允许传统显示覆盖", () => {
    expect(formatPeriods(westernQinPeriods)).toBe("385—400、409—431");
    expect(formatPeriods(westernQinPeriods, "传统纪年")).toBe("传统纪年");
  });
});
