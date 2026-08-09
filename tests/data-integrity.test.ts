import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import { isYearInPeriods } from "../src/domain/chronology";
import { validateCrownlineData } from "../src/domain/dataValidation";
import { selectRulerSnapshot } from "../src/domain/rulerSnapshot";

const data = await loadSourceData();
const details = buildGeneratedArtifacts(data).details;

const NON_MAINLINE_POLITY_BATCHES = {
  hanThreeKingdoms: [
    "polity-cn-xin",
    "polity-cn-cao-wei",
    "polity-cn-shu-han",
    "polity-cn-eastern-wu"
  ],
  sixteenKingdoms: [
    "polity-cn-former-liang", "polity-cn-cheng-han", "polity-cn-han-zhao",
    "polity-cn-later-zhao", "polity-cn-former-yan", "polity-cn-former-qin",
    "polity-cn-later-qin", "polity-cn-later-yan", "polity-cn-western-qin",
    "polity-cn-later-liang-lu", "polity-cn-southern-liang-tufa",
    "polity-cn-northern-liang", "polity-cn-southern-yan", "polity-cn-western-liang",
    "polity-cn-hu-xia", "polity-cn-northern-yan"
  ],
  northernSouthernDynasties: [
    "polity-cn-northern-wei", "polity-cn-eastern-wei", "polity-cn-western-wei",
    "polity-cn-northern-qi", "polity-cn-northern-zhou", "polity-cn-liu-song",
    "polity-cn-southern-qi", "polity-cn-liang", "polity-cn-chen"
  ],
  suiTangFiveDynasties: [
    "polity-cn-wu-zhou", "polity-cn-later-liang-zhu", "polity-cn-later-tang",
    "polity-cn-later-jin", "polity-cn-later-han", "polity-cn-later-zhou",
    "polity-cn-yang-wu", "polity-cn-southern-tang", "polity-cn-wuyue",
    "polity-cn-min", "polity-cn-ma-chu", "polity-cn-former-shu",
    "polity-cn-later-shu", "polity-cn-southern-han", "polity-cn-jingnan",
    "polity-cn-northern-han", "polity-tibet-empire", "polity-balhae", "polity-nanzhao"
  ],
  laterPolities: [
    "polity-cn-liao", "polity-dali", "polity-cn-western-xia", "polity-cn-jin",
    "polity-mongol-empire", "polity-cn-later-jin-jurchen", "polity-cn-southern-ming"
  ]
} as const;

function expectPolityDetails(entityIds: readonly string[]) {
  for (const entityId of entityIds) {
    const entity = data.entities.find(({ id }) => id === entityId);
    expect(entity, entityId).toBeDefined();
    expect(entity?.description.length, entityId).toBeGreaterThanOrEqual(60);
    expect(entity?.sourceRefs.length, entityId).toBeGreaterThan(0);
    expect(data.reigns.some(({ polityId }) => polityId === entityId), entityId).toBe(true);
  }
}

function expectWorldPolityDetails(entityId: string, minimumReignCount: number) {
  const entity = data.entities.find(({ id }) => id === entityId);
  const reigns = data.reigns.filter(({ polityId }) => polityId === entityId);

  expect(entity, entityId).toBeDefined();
  expect(entity?.description.length, entityId).toBeGreaterThanOrEqual(60);
  expect(entity?.sourceRefs.length, entityId).toBeGreaterThan(0);
  expect(reigns.length, entityId).toBeGreaterThanOrEqual(minimumReignCount);
  expect(reigns.every(({ sourceRefs }) => sourceRefs.length > 0), entityId).toBe(true);
}

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
    expect(mainlineIds.every((id) => data.reigns.some(({ polityId }) => polityId === id)))
      .toBe(true);
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
    expect(rulerSnapshot("polity-cn-xia", -2069).status).toBe(
      "unrecorded"
    );
  });

  it("补全拜占庭帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-byzantine-empire", 80);

    const year1000 = rulerSnapshot("polity-byzantine-empire", 1000);
    expect(year1000.status).toBe("known");
    expect(year1000.entries.map(({ person }) => person.id)).toEqual(expect.arrayContaining([
      "person-byzantine-basil-ii",
      "person-byzantine-constantine-viii"
    ]));

    expect(rulerSnapshot("polity-byzantine-empire", 1220).status).toBe("known");
    expect(rulerSnapshot("polity-byzantine-empire", 1453).entries.map(({ person }) => person.id))
      .toContain("person-byzantine-constantine-xi");
  });

  it("补全阿拔斯哈里发详情与统治者", () => {
    expectWorldPolityDetails("polity-abbasid-caliphate", 37);
    expect(rulerSnapshot("polity-abbasid-caliphate", 800).entries.map(({ person }) => person.id))
      .toContain("person-abbasid-harun-al-rashid");
    expect(rulerSnapshot("polity-abbasid-caliphate", 1258).entries.map(({ person }) => person.id))
      .toContain("person-abbasid-al-mustasim");
  });

  it("补全神圣罗马帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-holy-roman-empire", 45);
    expect(rulerSnapshot("polity-holy-roman-empire", 1000).entries.map(({ person }) => person.id))
      .toContain("person-hre-otto-iii");
    expect(rulerSnapshot("polity-holy-roman-empire", 1700).entries.map(({ person }) => person.id))
      .toContain("person-hre-leopold-i");
    expect(rulerSnapshot("polity-holy-roman-empire", 1806).entries.map(({ person }) => person.id))
      .toContain("person-hre-francis-ii");
  });

  it("补全朱罗帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-chola-empire", 20);
    expect(rulerSnapshot("polity-chola-empire", 1010).entries.map(({ person }) => person.id))
      .toContain("person-chola-rajaraja-i");
    expect(rulerSnapshot("polity-chola-empire", 1070).entries.map(({ person }) => person.id))
      .toContain("person-chola-kulottunga-i");
    expect(rulerSnapshot("polity-chola-empire", 1279).entries.map(({ person }) => person.id))
      .toContain("person-chola-rajendra-iii");
  });

  it("补全汉与三国四个非主线政权的详情", () => {
    expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.hanThreeKingdoms);
    expect(rulerSnapshot("polity-cn-xin", 15).status).toBe("known");
    expect(rulerSnapshot("polity-cn-cao-wei", 240).status).toBe("known");
    expect(rulerSnapshot("polity-cn-shu-han", 250).status).toBe("known");
    expect(rulerSnapshot("polity-cn-eastern-wu", 252).status).toBe("known");
  });

  it("补全两晋与十六国十六个并立政权的详情", () => {
    expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.sixteenKingdoms);
    expect(rulerSnapshot("polity-cn-former-qin", 383).status).toBe("known");
    expect(rulerSnapshot("polity-cn-western-qin", 405).status).toBe("unrecorded");
    expect(rulerSnapshot("polity-cn-western-qin", 410).status).toBe("known");
    expect(rulerSnapshot("polity-cn-northern-liang", 420).status).toBe("known");
  });

  it("补全南北朝九个并立政权的详情", () => {
    expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.northernSouthernDynasties);
    expect(rulerSnapshot("polity-cn-northern-wei", 500).status).toBe("known");
    expect(rulerSnapshot("polity-cn-liu-song", 450).status).toBe("known");
    expect(rulerSnapshot("polity-cn-chen", 580).status).toBe("known");
  });

  it("补全隋唐五代十国及同期区域政权详情", () => {
    expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.suiTangFiveDynasties);
    expect(rulerSnapshot("polity-cn-wu-zhou", 700).status).toBe("known");
    expect(rulerSnapshot("polity-cn-later-tang", 930).status).toBe("known");
    expect(rulerSnapshot("polity-tibet-empire", 755).status).toBe("known");
    expect(rulerSnapshot("polity-nanzhao", 800).status).toBe("known");
  });

  it("补全辽夏金元与明清并立政权详情", () => {
    expectPolityDetails(NON_MAINLINE_POLITY_BATCHES.laterPolities);
    expect(rulerSnapshot("polity-cn-liao", 1000).status).toBe("known");
    expect(rulerSnapshot("polity-cn-western-xia", 1100).status).toBe("known");
    expect(rulerSnapshot("polity-cn-jin", 1200).status).toBe("known");
    expect(rulerSnapshot("polity-cn-southern-ming", 1646).entries.length)
      .toBeGreaterThan(0);
  });

  it("为全部七十一个中国政权提供统治者详情", () => {
    const chinesePolityIds = data.entities
      .filter(({ entityKind, historicalRegionIds }) => {
        return entityKind === "polity" && historicalRegionIds.includes("region-china");
      })
      .map(({ id }) => id);

    expect(chinesePolityIds).toHaveLength(71);
    expect(chinesePolityIds.every((id) => data.reigns.some(({ polityId }) => polityId === id)))
      .toBe(true);
  });
});
