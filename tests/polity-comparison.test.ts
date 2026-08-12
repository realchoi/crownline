import { describe, expect, it } from "vitest";

import {
  buildPolityComparison,
  intersectHistoricalPeriods,
  selectRulersDuringPeriods
} from "../src/domain/polityComparison";
import type {
  CrownlineDetail,
  HistoricalEntity,
  HistoricalInterval
} from "../src/domain/types";

const interval = (
  start: number,
  end: number,
  startPrecision: HistoricalInterval["start"]["precision"] = "exact",
  endPrecision: HistoricalInterval["end"]["precision"] = "exact"
): HistoricalInterval => ({
  start: { year: start, precision: startPrecision },
  end: { year: end, precision: endPrecision }
});

const polity = (id: string, periods: HistoricalInterval[]): HistoricalEntity => ({
  id,
  entityKind: "polity",
  polityForms: ["dynasty"],
  displayCategory: "mainline",
  names: { primary: id, aliases: [] },
  existencePeriods: periods,
  chronologyStatus: "accepted",
  historicalRegionIds: ["region-test"],
  culturalSphereIds: [],
  modernAreaIds: [],
  description: `${id} description`,
  sourceRefs: [],
  confidence: "high"
});

describe("双政权时间对比", () => {
  it("计算无交集、单段交集和闭区间边界", () => {
    expect(intersectHistoricalPeriods([interval(1, 5)], [interval(6, 10)])).toEqual([]);
    expect(intersectHistoricalPeriods([interval(1, 5)], [interval(5, 10)])).toEqual([
      interval(5, 5)
    ]);
    expect(intersectHistoricalPeriods([interval(1, 8)], [interval(3, 5)])).toEqual([
      interval(3, 5)
    ]);
  });

  it("保留多段交集并跨公元前后跳过公元零年", () => {
    const result = intersectHistoricalPeriods(
      [interval(-10, -1), interval(5, 10)],
      [interval(-5, 5)]
    );

    expect(result).toEqual([interval(-5, -1), interval(5, 5)]);
    expect(buildPolityComparison(
      polity("left", [interval(-10, -1), interval(5, 10)]),
      polity("right", [interval(-5, 5)])
    )).toMatchObject({
      overlapPeriods: [interval(-5, -1), interval(5, 5)],
      overlapYears: 6
    });
  });

  it("边界年份相同时采用更保守的年代精度", () => {
    expect(intersectHistoricalPeriods(
      [interval(100, 200, "circa")],
      [interval(100, 150, "exact", "decade")]
    )).toEqual([interval(100, 150, "circa", "decade")]);
  });

  it("筛选并裁剪共同存续期内的统治者任期", () => {
    const left = polity("left", [interval(1, 20)]);
    const detail: CrownlineDetail = {
      schemaVersion: 3,
      entityId: "left",
      persons: [
        {
          id: "person-a",
          names: { primary: "甲", aliases: [] },
          description: "甲",
          sourceRefs: []
        },
        {
          id: "person-b",
          names: { primary: "乙", aliases: [] },
          description: "乙",
          sourceRefs: []
        }
      ],
      reigns: [
        {
          id: "reign-a",
          personId: "person-a",
          polityId: "left",
          titles: ["王"],
          role: "ruler",
          periods: [interval(1, 8), interval(12, 16)],
          chronologyStatus: "accepted",
          sourceRefs: [],
          confidence: "high"
        },
        {
          id: "reign-b",
          personId: "person-b",
          polityId: "left",
          titles: ["摄政"],
          role: "regent",
          periods: [interval(17, 20)],
          chronologyStatus: "accepted",
          sourceRefs: [],
          confidence: "high"
        }
      ],
      reignVacancies: [],
      relationships: [],
      events: [],
      sources: []
    };

    expect(selectRulersDuringPeriods(left, detail, [interval(5, 14)])).toEqual([
      expect.objectContaining({
        person: expect.objectContaining({ names: expect.objectContaining({ primary: "甲" }) }),
        reign: expect.objectContaining({ role: "ruler" }),
        periods: [interval(5, 8), interval(12, 14)]
      })
    ]);
  });

  it("拒绝把其他政权的详情用于共同期统治者", () => {
    const left = polity("left", [interval(1, 20)]);
    const detail = {
      schemaVersion: 3,
      entityId: "right",
      persons: [],
      reigns: [],
      reignVacancies: [],
      relationships: [],
      events: [],
      sources: []
    } satisfies CrownlineDetail;

    expect(() => selectRulersDuringPeriods(left, detail, [interval(5, 10)]))
      .toThrow("详情与政权 left 不匹配");
  });
});
