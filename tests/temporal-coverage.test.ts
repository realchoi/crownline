import { describe, expect, it } from "vitest";

import {
  buildPolityTemporalCoverage,
  countHistoricalYears,
  intersectHistoricalYearRanges,
  normalizeHistoricalYearRanges,
  subtractHistoricalYearRanges
} from "../src/domain/temporalCoverage";
import type {
  GeographicSnapshot,
  HistoricalEntity,
  Reign,
  ReignVacancy
} from "../src/domain/types";

const entity: HistoricalEntity = {
  id: "polity-test",
  entityKind: "polity",
  polityForms: ["state"],
  displayCategory: "context",
  names: { primary: "测试政权", aliases: [] },
  existencePeriods: [
    {
      start: { year: -3, precision: "exact" },
      end: { year: 2, precision: "exact" }
    },
    {
      start: { year: 8, precision: "exact" },
      end: { year: 10, precision: "exact" }
    }
  ],
  chronologyStatus: "accepted",
  historicalRegionIds: [],
  culturalSphereIds: [],
  modernAreaIds: [],
  description: "测试",
  sourceRefs: [],
  confidence: "high"
};

function reign(id: string, role: Reign["role"], periods: Reign["periods"]): Reign {
  return {
    id,
    personId: `person-${id}`,
    polityId: entity.id,
    titles: [],
    role,
    periods,
    chronologyStatus: "accepted",
    sourceRefs: [],
    confidence: "high"
  };
}

describe("历史年份覆盖区间运算", () => {
  it("跨公元前后时跳过公元 0 年并按闭区间计数", () => {
    expect(countHistoricalYears([{ startYear: -2, endYear: 2 }])).toBe(4);
    expect(
      normalizeHistoricalYearRanges([
        { startYear: 1, endYear: 2 },
        { startYear: -2, endYear: -1 }
      ])
    ).toEqual([{ startYear: -2, endYear: 2 }]);
  });

  it("稳定合并无序的重叠、相邻和重复区间", () => {
    const ranges = [
      { startYear: 4, endYear: 5 },
      { startYear: 1, endYear: 3 },
      { startYear: 2, endYear: 4 },
      { startYear: 9, endYear: 9 }
    ];
    const expected = [
      { startYear: 1, endYear: 5 },
      { startYear: 9, endYear: 9 }
    ];
    expect(normalizeHistoricalYearRanges(ranges)).toEqual(expected);
    expect(normalizeHistoricalYearRanges([...ranges].reverse())).toEqual(expected);
    expect(countHistoricalYears(ranges)).toBe(6);
  });

  it("求交集和差集时保留多段存在且不跨越中断期", () => {
    const existence = [
      { startYear: -3, endYear: 2 },
      { startYear: 8, endYear: 10 }
    ];
    expect(intersectHistoricalYearRanges([{ startYear: -5, endYear: 9 }], existence)).toEqual([
      { startYear: -3, endYear: 2 },
      { startYear: 8, endYear: 9 }
    ]);
    expect(
      subtractHistoricalYearRanges(existence, [
        { startYear: -2, endYear: -1 },
        { startYear: 1, endYear: 1 },
        { startYear: 9, endYear: 12 }
      ])
    ).toEqual([
      { startYear: -3, endYear: -3 },
      { startYear: 2, endYear: 2 },
      { startYear: 8, endYear: 8 }
    ]);
  });

  it("拒绝公元 0 年和反向区间", () => {
    expect(() => countHistoricalYears([{ startYear: 0, endYear: 1 }])).toThrow("公元 0 年");
    expect(() => countHistoricalYears([{ startYear: 2, endYear: 1 }])).toThrow("起点不得晚于终点");
  });
});

describe("政权逐年资料覆盖", () => {
  it("共治重叠不重复计数，摄政和争位不自动算作正式统治者资料", () => {
    const reigns: Reign[] = [
      reign("ruler-a", "ruler", [
        { start: { year: -3, precision: "exact" }, end: { year: -1, precision: "exact" } }
      ]),
      reign("co-ruler", "co-ruler", [
        { start: { year: -2, precision: "exact" }, end: { year: 1, precision: "exact" } }
      ]),
      reign("regent", "regent", [
        { start: { year: 2, precision: "exact" }, end: { year: 2, precision: "exact" } }
      ]),
      reign("contender", "contender", [
        { start: { year: 8, precision: "exact" }, end: { year: 8, precision: "exact" } }
      ])
    ];
    const vacancies: ReignVacancy[] = [
      {
        id: "vacancy-test",
        polityId: entity.id,
        periods: [{ start: { year: 9, precision: "exact" }, end: { year: 9, precision: "exact" } }],
        note: "测试空位",
        sourceRefs: [],
        confidence: "high"
      }
    ];
    const geography: GeographicSnapshot[] = [
      {
        id: "geo-test",
        polityId: entity.id,
        periods: [{ start: { year: 1, precision: "exact" }, end: { year: 8, precision: "exact" } }],
        placeName: "测试地点",
        role: "capital",
        coordinates: { latitude: 1, longitude: 1 },
        positionPrecision: "approximate",
        positionNote: "测试",
        sourceRefs: [],
        confidence: "high"
      }
    ];

    const result = buildPolityTemporalCoverage(entity, reigns, vacancies, geography);

    expect(result.totalExistenceYears).toBe(8);
    expect(result.rulerDetails).toMatchObject({
      rulerPeriods: [{ startYear: -3, endYear: 1 }],
      explicitVacancyPeriods: [{ startYear: 9, endYear: 9 }],
      regencyPeriods: [{ startYear: 2, endYear: 2 }],
      claimantPeriods: [{ startYear: 8, endYear: 8 }],
      anyReignPeriods: [
        { startYear: -3, endYear: 2 },
        { startYear: 8, endYear: 8 }
      ],
      unknownPeriods: [
        { startYear: 2, endYear: 2 },
        { startYear: 8, endYear: 8 },
        { startYear: 10, endYear: 10 }
      ],
      rulerCoveredYears: 4,
      explicitVacancyYears: 1,
      regencyYears: 1,
      claimantYears: 1,
      anyReignYears: 6,
      documentedYears: 5,
      unknownYears: 3,
      rulerCoveragePercentage: 50,
      documentedPercentage: 62.5
    });
    expect(result.geography).toEqual({
      coveredPeriods: [
        { startYear: 1, endYear: 2 },
        { startYear: 8, endYear: 8 }
      ],
      unknownPeriods: [
        { startYear: -3, endYear: -1 },
        { startYear: 9, endYear: 10 }
      ],
      coveredYears: 3,
      unknownYears: 5,
      coveredPercentage: 37.5
    });
  });

  it("只读取目标政权记录，且输入顺序不影响输出", () => {
    const target = reign("target", "ruler", [
      { start: { year: 8, precision: "exact" }, end: { year: 10, precision: "exact" } }
    ]);
    const other = { ...target, id: "other", polityId: "polity-other" };
    const first = buildPolityTemporalCoverage(entity, [other, target], [], []);
    const second = buildPolityTemporalCoverage(entity, [target, other], [], []);

    expect(first).toEqual(second);
    expect(first.rulerDetails.rulerPeriods).toEqual([{ startYear: 8, endYear: 10 }]);
  });
});
