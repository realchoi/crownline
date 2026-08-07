import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import { isYearInPeriods } from "../src/domain/chronology";
import { validateCrownlineData } from "../src/domain/dataValidation";
import { selectRulerSnapshot } from "../src/domain/rulerSnapshot";

const data = await loadSourceData();
const details = buildGeneratedArtifacts(data).details;

function rulerSnapshot(entityId: string, year: number) {
  const entity = data.entities.find(({ id }) => id === entityId);
  const detail = details.get(entityId);
  if (!entity || !detail) throw new Error(`缺少测试详情 ${entityId}`);
  return selectRulerSnapshot(entity, detail, year);
}

describe("生产历史数据", () => {
  it("保留中国七个阶段和七十三个时间轴实体，并加入四个外部代表条目", () => {
    expect(data.timelineSections).toHaveLength(7);
    expect(data.entities).toHaveLength(77);
    expect(data.timelineSections.flatMap((section) => section.entityIds)).toHaveLength(73);
    expect(data.entities.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "polity-byzantine-empire",
      "polity-abbasid-caliphate",
      "polity-holy-roman-empire",
      "polity-chola-empire"
    ]));
    expect(data.entities.find(({ id }) => id === "polity-byzantine-empire")?.historicalRegionIds)
      .toEqual(["region-europe", "region-west-asia"]);
  });

  it("提供可自选的外部地区和明确未收录地区", () => {
    const regionStatuses = new Map(data.regions.map((region) => [region.id, region.coverage.status]));
    expect([...regionStatuses]).toEqual(expect.arrayContaining([
      ["region-south-asia", "sample"],
      ["region-west-asia", "sample"],
      ["region-europe", "sample"],
      ["region-north-africa", "sample"],
      ["region-americas", "none"]
    ]));
  });

  it("用多段区间表达唐和西秦的中断", () => {
    const tang = data.entities.find(({ id }) => id === "polity-cn-tang");
    const westernQin = data.entities.find(({ id }) => id === "polity-cn-western-qin");

    expect(tang?.existencePeriods).toHaveLength(2);
    expect(isYearInPeriods(690, tang?.existencePeriods ?? [])).toBe(true);
    expect(isYearInPeriods(691, tang?.existencePeriods ?? [])).toBe(false);
    expect(isYearInPeriods(705, tang?.existencePeriods ?? [])).toBe(true);

    expect(westernQin?.existencePeriods).toHaveLength(2);
    expect(isYearInPeriods(400, westernQin?.existencePeriods ?? [])).toBe(true);
    expect(isYearInPeriods(405, westernQin?.existencePeriods ?? [])).toBe(false);
    expect(isYearInPeriods(409, westernQin?.existencePeriods ?? [])).toBe(true);
  });

  it("通过结构和跨记录校验", () => {
    expect(validateCrownlineData(data)).toEqual({ valid: true, issues: [] });
    expect(data.entities).toHaveLength(77);
  });

  it("为全部十六个中国主线政权提供经过校订的任期数据", () => {
    const mainlineIds = data.entities
      .filter(({ entityKind, displayCategory }) => {
        return entityKind === "polity" && displayCategory === "mainline";
      })
      .map(({ id }) => id);

    expect(mainlineIds).toHaveLength(16);
    expect(new Set(data.reigns.map(({ polityId }) => polityId))).toEqual(new Set(mainlineIds));
    expect(data.persons.length).toBeGreaterThan(0);
    expect(
      data.reignVacancies.some(({ polityId }) => polityId === "polity-cn-western-zhou")
    ).toBe(true);
  });

  it("在真实数据中覆盖单人、摄政、争议、空位和未校订状态", () => {
    expect(rulerSnapshot("polity-cn-ming", 1400).status).toBe("known");

    const qing = rulerSnapshot("polity-cn-qing", 1862);
    expect(qing.status).toBe("known");
    expect(qing.entries.map(({ reign }) => reign.role)).toEqual(["ruler", "regent", "regent"]);

    expect(rulerSnapshot("polity-cn-xia", -2070).status).toBe("disputed");
    expect(rulerSnapshot("polity-cn-western-zhou", -840).status).toBe("vacant");
    expect(rulerSnapshot("polity-byzantine-empire", 1000).status).toBe(
      "unrecorded"
    );
  });
});
