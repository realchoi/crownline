import { describe, expect, it } from "vitest";

import { selectRulerSnapshot } from "../src/domain/rulerSnapshot";
import type { CrownlineData, HistoricalInterval, Person, Reign } from "../src/domain/types";

const period = (start: number, end: number): HistoricalInterval => ({
  start: { year: start, precision: "exact" },
  end: { year: end, precision: "exact" }
});

const person = (id: string, name: string): Person => ({
  id,
  names: { primary: name, aliases: [] },
  description: `${name}的测试人物记录。`,
  sourceRefs: [{ sourceId: "source-test" }]
});

const reign = (
  id: string,
  personId: string,
  role: Reign["role"],
  periods: HistoricalInterval[],
  overrides: Partial<Reign> = {}
): Reign => ({
  id,
  personId,
  polityId: "polity-test",
  titles: ["君主"],
  role,
  periods,
  chronologyStatus: "accepted",
  sourceRefs: [{ sourceId: "source-test" }],
  confidence: "high",
  ...overrides
});

function makeData(): CrownlineData {
  return {
    schemaVersion: 3,
    chronologyPolicy: {
      calendar: "historical-year",
      hasYearZero: false,
      intervalBoundary: "inclusive",
      yearSelection: "exists-at-any-time-during-year"
    },
    timelineSections: [],
    entities: [
      {
        id: "polity-test",
        entityKind: "polity",
        polityForms: ["kingdom"],
        displayCategory: "mainline",
        names: { primary: "测试政权", aliases: [] },
        existencePeriods: [period(1, 12)],
        chronologyStatus: "accepted",
        historicalRegionIds: ["region-test"],
        culturalSphereIds: [],
        modernAreaIds: [],
        description: "用于测试统治者快照。",
        sourceRefs: [{ sourceId: "source-test" }],
        confidence: "high"
      }
    ],
    regions: [],
    persons: [
      person("person-ruler", "甲王"),
      person("person-regent", "乙摄政"),
      person("person-contender", "丙争位者")
    ],
    reigns: [
      reign("reign-ruler", "person-ruler", "ruler", [period(1, 5), period(11, 12)]),
      reign("reign-regent", "person-regent", "regent", [period(4, 4)], {
        titles: ["摄政"]
      }),
      reign("reign-contender", "person-contender", "contender", [period(6, 6)], {
        titles: ["争位者"]
      })
    ],
    reignVacancies: [
      {
        id: "vacancy-test",
        polityId: "polity-test",
        periods: [period(8, 9)],
        note: "有来源支持的测试空位。",
        sourceRefs: [{ sourceId: "source-test" }],
        confidence: "high"
      }
    ],
    relationships: [],
    events: [],
    sources: [
      {
        id: "source-test",
        title: "测试来源",
        sourceType: "dataset",
        citation: "仅供自动化测试使用。"
      }
    ]
  };
}

describe("当年统治者快照", () => {
  it("在闭区间端点命中单一统治者", () => {
    const data = makeData();

    expect(selectRulerSnapshot(data, "polity-test", 1)).toMatchObject({
      status: "known",
      entries: [{ person: { names: { primary: "甲王" } } }]
    });
    expect(selectRulerSnapshot(data, "polity-test", 5).status).toBe("known");
  });

  it("稳定返回同年的统治者和摄政者且不误标争议", () => {
    const snapshot = selectRulerSnapshot(makeData(), "polity-test", 4);

    expect(snapshot.status).toBe("known");
    expect(snapshot.entries.map(({ reign }) => reign.role)).toEqual(["ruler", "regent"]);
  });

  it("把争位者或争议任期标成争议", () => {
    const data = makeData();
    expect(selectRulerSnapshot(data, "polity-test", 6).status).toBe("disputed");

    data.reigns[0]!.chronologyStatus = "disputed";
    expect(selectRulerSnapshot(data, "polity-test", 2).status).toBe("disputed");
  });

  it("区分明确空位和未收录资料", () => {
    expect(selectRulerSnapshot(makeData(), "polity-test", 8)).toMatchObject({
      status: "vacant",
      vacancy: { id: "vacancy-test" }
    });
    expect(selectRulerSnapshot(makeData(), "polity-test", 10)).toMatchObject({
      status: "unrecorded",
      entries: []
    });
  });

  it("任期中断时只在实际分段内命中", () => {
    const data = makeData();

    expect(selectRulerSnapshot(data, "polity-test", 7).status).toBe("unrecorded");
    expect(selectRulerSnapshot(data, "polity-test", 11).status).toBe("known");
  });

  it("跨越公元前后时跳过公元零年", () => {
    const data = makeData();
    data.entities[0]!.existencePeriods = [period(-2, 2)];
    data.reigns[0]!.periods = [period(-1, 1)];
    data.reigns = [data.reigns[0]!];
    data.reignVacancies = [];

    expect(selectRulerSnapshot(data, "polity-test", -1).status).toBe("known");
    expect(selectRulerSnapshot(data, "polity-test", 1).status).toBe("known");
  });

  it("拒绝不存在的政权 ID", () => {
    expect(() => selectRulerSnapshot(makeData(), "polity-missing", 2)).toThrow(
      "polity-missing"
    );
  });
});
