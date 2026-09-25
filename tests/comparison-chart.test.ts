import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildComparisonChart } from "../src/domain/comparisonChart";
import { buildPolityComparison } from "../src/domain/polityComparison";

const data = await loadSourceData();
const entity = (id: string) => data.entities.find((candidate) => candidate.id === id)!;
const compare = (leftId: string, rightId: string) =>
  buildPolityComparison(entity(leftId), entity(rightId));

describe("双政权时间对比图", () => {
  it("以双方存续并集为比例尺绘制两条轨道与共同存续区间", () => {
    const chart = buildComparisonChart(compare("polity-cn-eastern-han", "polity-kushan-empire"));

    expect(chart.range).toEqual({ startYear: 25, endYear: 230 });
    const [left, right] = chart.tracks;
    expect(left).toHaveLength(1);
    expect(left[0]!.left).toBe(0);
    expect(left[0]!.width).toBeCloseTo((195 / 205) * 100, 6);
    expect(right[0]!.left).toBeCloseTo((25 / 205) * 100, 6);
    expect(right[0]!.width).toBeCloseTo((180 / 205) * 100, 6);
    expect(chart.overlaps).toHaveLength(1);
    expect(chart.overlaps[0]!.left).toBeCloseTo((25 / 205) * 100, 6);
    expect(chart.overlaps[0]!.width).toBeCloseTo((170 / 205) * 100, 6);
  });

  it("多段存续分别绘制，并给出多段共同存续区间", () => {
    const chart = buildComparisonChart(compare("polity-cn-western-qin", "polity-cn-northern-wei"));

    expect(chart.tracks[0]).toHaveLength(2);
    expect(chart.tracks[1]).toHaveLength(1);
    expect(chart.overlaps).toHaveLength(2);
  });

  it("跨越公元前后按连续序数计算位置，没有交集时不绘制共同区间", () => {
    const chart = buildComparisonChart(compare("polity-cn-western-han", "polity-cn-xin"));

    // 前202 到 23 共 224 个序数单位；新始于公元 9 年，即第 210 个单位。
    expect(chart.range).toEqual({ startYear: -202, endYear: 23 });
    expect(chart.tracks[1][0]!.left).toBeCloseTo((210 / 224) * 100, 6);
    expect(chart.overlaps).toEqual([]);
  });

  it("只在比例尺范围内标出当前年份", () => {
    const comparison = compare("polity-cn-eastern-han", "polity-kushan-empire");

    expect(buildComparisonChart(comparison, 100).currentYearPosition).toBeCloseTo(
      (75 / 205) * 100,
      6
    );
    expect(buildComparisonChart(comparison, 1000).currentYearPosition).toBeUndefined();
    expect(buildComparisonChart(comparison).currentYearPosition).toBeUndefined();
  });
});
