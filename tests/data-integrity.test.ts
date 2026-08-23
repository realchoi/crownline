import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import { isYearInPeriods } from "../src/domain/chronology";
import { validateCrownlineData } from "../src/domain/dataValidation";
import { selectRulerSnapshot } from "../src/domain/rulerSnapshot";
import { RELATIONSHIP_TYPES } from "../src/domain/types";
import { GLOBAL_SAMPLE_POLITY_IDS } from "./global-sample-polities";
import { CHINA_MAP_POLITY_IDS, WORLD_MAP_POLITY_IDS } from "./map-sample-polities";

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
    "polity-cn-former-liang",
    "polity-cn-cheng-han",
    "polity-cn-han-zhao",
    "polity-cn-later-zhao",
    "polity-cn-former-yan",
    "polity-cn-former-qin",
    "polity-cn-later-qin",
    "polity-cn-later-yan",
    "polity-cn-western-qin",
    "polity-cn-later-liang-lu",
    "polity-cn-southern-liang-tufa",
    "polity-cn-northern-liang",
    "polity-cn-southern-yan",
    "polity-cn-western-liang",
    "polity-cn-hu-xia",
    "polity-cn-northern-yan"
  ],
  northernSouthernDynasties: [
    "polity-cn-northern-wei",
    "polity-cn-eastern-wei",
    "polity-cn-western-wei",
    "polity-cn-northern-qi",
    "polity-cn-northern-zhou",
    "polity-cn-liu-song",
    "polity-cn-southern-qi",
    "polity-cn-liang",
    "polity-cn-chen"
  ],
  suiTangFiveDynasties: [
    "polity-cn-wu-zhou",
    "polity-cn-later-liang-zhu",
    "polity-cn-later-tang",
    "polity-cn-later-jin",
    "polity-cn-later-han",
    "polity-cn-later-zhou",
    "polity-cn-yang-wu",
    "polity-cn-southern-tang",
    "polity-cn-wuyue",
    "polity-cn-min",
    "polity-cn-ma-chu",
    "polity-cn-former-shu",
    "polity-cn-later-shu",
    "polity-cn-southern-han",
    "polity-cn-jingnan",
    "polity-cn-northern-han",
    "polity-tibet-empire",
    "polity-balhae",
    "polity-nanzhao"
  ],
  laterPolities: [
    "polity-cn-liao",
    "polity-dali",
    "polity-cn-western-xia",
    "polity-cn-jin",
    "polity-mongol-empire",
    "polity-cn-later-jin-jurchen",
    "polity-cn-southern-ming"
  ]
} as const;

function expectPolityDetails(entityIds: readonly string[]) {
  for (const entityId of entityIds) {
    const entity = data.entities.find(({ id }) => id === entityId);
    expect(entity, entityId).toBeDefined();
    expect(entity?.description.length, entityId).toBeGreaterThanOrEqual(60);
    expect(entity?.sourceRefs.length, entityId).toBeGreaterThan(0);
    expect(
      data.reigns.some(({ polityId }) => polityId === entityId),
      entityId
    ).toBe(true);
  }
}

function expectWorldPolityDetails(entityId: string, minimumReignCount: number) {
  const entity = data.entities.find(({ id }) => id === entityId);
  const reigns = data.reigns.filter(({ polityId }) => polityId === entityId);

  expect(entity, entityId).toBeDefined();
  expect(entity?.description.length, entityId).toBeGreaterThanOrEqual(60);
  expect(entity?.sourceRefs.length, entityId).toBeGreaterThan(0);
  expect(reigns.length, entityId).toBeGreaterThanOrEqual(minimumReignCount);
  expect(
    reigns.every(({ sourceRefs }) => sourceRefs.length > 0),
    entityId
  ).toBe(true);
}

function rulerSnapshot(entityId: string, year: number) {
  const entity = data.entities.find(({ id }) => id === entityId);
  const detail = details.get(entityId);
  if (!entity || !detail) throw new Error(`缺少测试详情 ${entityId}`);
  return selectRulerSnapshot(entity, detail, year);
}

function activePlaces(polityId: string, year: number): string[] {
  return data.geographicSnapshots
    .filter((snapshot) => {
      return snapshot.polityId === polityId && isYearInPeriods(year, snapshot.periods);
    })
    .map(({ placeName }) => placeName);
}

function mappedTopLevelRegionIds(): Set<string> {
  const mappedPolityIds = new Set(data.geographicSnapshots.map(({ polityId }) => polityId));
  const regionById = new Map(data.regions.map((region) => [region.id, region]));
  const topLevelIds = new Set<string>();

  data.entities
    .filter(({ id }) => mappedPolityIds.has(id))
    .flatMap(({ historicalRegionIds }) => historicalRegionIds)
    .forEach((regionId) => {
      let current = regionById.get(regionId);
      while (current?.parentRegionId) current = regionById.get(current.parentRegionId);
      if (current) topLevelIds.add(current.id);
    });

  return topLevelIds;
}

describe("生产历史数据", () => {
  it("保留中国七个阶段和七十三个时间轴实体，并扩展全球总实体数量", () => {
    expect(data.timelineSections).toHaveLength(7);
    expect(data.entities).toHaveLength(133);
    expect(data.timelineSections.flatMap((section) => section.entityIds)).toHaveLength(73);
    expect(data.entities.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "polity-byzantine-empire",
        "polity-abbasid-caliphate",
        "polity-holy-roman-empire",
        "polity-chola-empire"
      ])
    );
    expect(
      data.entities.find(({ id }) => id === "polity-byzantine-empire")?.historicalRegionIds
    ).toEqual(["region-europe", "region-west-asia"]);
  });

  it("收录全球均衡样本政权并为每条政权接入任期", () => {
    expect(data.entities).toHaveLength(133);
    expect(data.entities.map(({ id }) => id)).toEqual(
      expect.arrayContaining([...GLOBAL_SAMPLE_POLITY_IDS])
    );
    for (const entityId of GLOBAL_SAMPLE_POLITY_IDS) {
      expect(
        data.reigns.some(({ polityId }) => polityId === entityId),
        entityId
      ).toBe(true);
    }
  });

  it("有本地名称的实体均携带有效语言标签", () => {
    const localizedEntities = data.entities.filter(({ names }) => names.local !== undefined);

    expect(localizedEntities).toHaveLength(49);
    for (const entity of localizedEntities) {
      expect(entity.names.localLanguageTag, entity.id).toBeTruthy();
      expect(
        () => Intl.getCanonicalLocales(entity.names.localLanguageTag!),
        entity.id
      ).not.toThrow();
    }
  });

  it("为六十个世界样本政权提供九十一条可追溯地理快照", () => {
    const worldSnapshots = data.geographicSnapshots.filter(({ polityId }) => {
      return WORLD_MAP_POLITY_IDS.some((id) => id === polityId);
    });

    expect(worldSnapshots).toHaveLength(91);
    expect(worldSnapshots.every(({ sourceRefs }) => sourceRefs.length > 0)).toBe(true);
    for (const polityId of WORLD_MAP_POLITY_IDS) {
      expect(
        worldSnapshots.some((snapshot) => snapshot.polityId === polityId),
        polityId
      ).toBe(true);
    }
  });

  it("为二十六个中国代表政权提供三十六条地理快照并覆盖十一个顶层地区", () => {
    const chinaSnapshots = data.geographicSnapshots.filter(({ polityId }) => {
      return CHINA_MAP_POLITY_IDS.some((id) => id === polityId);
    });

    expect(chinaSnapshots).toHaveLength(35);
    expect(data.geographicSnapshots).toHaveLength(126);
    for (const polityId of CHINA_MAP_POLITY_IDS) {
      expect(
        chinaSnapshots.some((snapshot) => snapshot.polityId === polityId),
        polityId
      ).toBe(true);
    }
    expect(mappedTopLevelRegionIds()).toEqual(
      new Set([
        "region-east-asia",
        "region-south-asia",
        "region-southeast-asia",
        "region-central-asia",
        "region-west-asia",
        "region-europe",
        "region-north-africa",
        "region-west-africa",
        "region-americas",
        "region-east-africa",
        "region-southern-africa"
      ])
    );
  });

  it("按年份切换中国政权的迁都点位", () => {
    expect(activePlaces("polity-cn-northern-wei", 450)).toEqual(["平城"]);
    expect(activePlaces("polity-cn-northern-wei", 500)).toEqual(["洛阳"]);
    expect(activePlaces("polity-cn-ming", 1400)).toEqual(["南京"]);
    expect(activePlaces("polity-cn-ming", 1500)).toEqual(["北京"]);
    expect(activePlaces("polity-cn-qing", 1640)).toEqual(["盛京"]);
    expect(activePlaces("polity-cn-qing", 1700)).toEqual(["北京"]);
    expect(activePlaces("polity-cn-jin", 1120)).toEqual(["会宁府"]);
    expect(activePlaces("polity-cn-jin", 1200)).toEqual(["中都"]);
    expect(activePlaces("polity-cn-jin", 1220)).toEqual(["汴京"]);
  });

  it("提供可自选的外部地区和明确覆盖状态", () => {
    const regionStatuses = new Map(
      data.regions.map((region) => [region.id, region.coverage.status])
    );
    expect([...regionStatuses]).toEqual(
      expect.arrayContaining([
        ["region-south-asia", "sample"],
        ["region-west-asia", "sample"],
        ["region-europe", "sample"],
        ["region-north-africa", "sample"]
      ])
    );
    expect(regionStatuses.get("region-southeast-asia")).toBe("sample");
    expect(regionStatuses.get("region-central-asia")).toBe("sample");
    expect(regionStatuses.get("region-west-africa")).toBe("sample");
    expect(regionStatuses.get("region-americas")).toBe("sample");
    expect(regionStatuses.get("region-east-africa")).toBe("sample");
    expect(regionStatuses.get("region-southern-africa")).toBe("sample");
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
    expect(data.entities).toHaveLength(133);
  });

  it("结构化关系覆盖七种类型并保持事件与来源闭合", () => {
    expect(new Set(data.relationships.map(({ type }) => type))).toEqual(
      new Set(RELATIONSHIP_TYPES)
    );
    expect(data.relationships).toHaveLength(18);
    expect(data.events).toHaveLength(14);
    expect(data.sources).toHaveLength(166);
    expect(
      data.relationships.every(({ sourceRefs }) => {
        return sourceRefs.length > 0 && sourceRefs.every(({ locator }) => Boolean(locator?.trim()));
      })
    ).toBe(true);
    expect(
      data.events.every(({ sourceRefs }) => {
        return sourceRefs.length > 0 && sourceRefs.every(({ locator }) => Boolean(locator?.trim()));
      })
    ).toBe(true);

    const relationshipById = new Map(
      data.relationships.map((relationship) => [relationship.id, relationship])
    );
    expect(
      relationshipById.get("relationship-northern-song-liao-chanyuan-diplomacy")
    ).toMatchObject({
      type: "diplomacy",
      participants: [{ entityId: "polity-cn-northern-song" }, { entityId: "polity-cn-liao" }],
      eventIds: ["event-chanyuan-treaty"]
    });
    expect(relationshipById.get("relationship-liao-jin-war")).toMatchObject({
      type: "war",
      eventIds: ["event-liao-fall-to-jin"]
    });
    expect(relationshipById.get("relationship-northern-song-western-xia-war")).toMatchObject({
      type: "war",
      eventIds: ["event-song-xia-qingli-treaty"]
    });
    expect(relationshipById.get("relationship-mongol-abbasid-war")).toMatchObject({
      type: "war",
      eventIds: ["event-sack-of-baghdad"]
    });
    expect(relationshipById.get("relationship-ottoman-byzantine-constantinople-war")).toMatchObject(
      {
        type: "war",
        eventIds: ["event-fall-of-constantinople"]
      }
    );
    expect(
      relationshipById.get("relationship-delhi-sultanate-mughal-succession-war")
    ).toMatchObject({
      type: "war",
      eventIds: ["event-first-battle-of-panipat"]
    });

    expect(
      Object.fromEntries(
        data.relationships.map(({ id, periods }) => [
          id,
          periods.map(({ start, end }) => [start.year, end.year])
        ])
      )
    ).toMatchObject({
      "relationship-northern-song-jurchen-jin-alliance": [[1120, 1122]],
      "relationship-tang-balhae-tribute": [[713, 800]],
      "relationship-tang-abbasid-maritime-trade": [[830, 830]],
      "relationship-northern-song-liao-chanyuan-diplomacy": [[1004, 1005]],
      "relationship-liao-jin-war": [[1115, 1125]]
    });
  });

  it("为全部十六个中国主线政权提供经过校订的任期数据", () => {
    const mainlineIds = data.entities
      .filter(({ entityKind, displayCategory }) => {
        return entityKind === "polity" && displayCategory === "mainline";
      })
      .map(({ id }) => id);

    expect(mainlineIds).toHaveLength(16);
    expect(mainlineIds.every((id) => data.reigns.some(({ polityId }) => polityId === id))).toBe(
      true
    );
    expect(data.persons.length).toBeGreaterThan(0);
    expect(data.reignVacancies.some(({ polityId }) => polityId === "polity-cn-western-zhou")).toBe(
      true
    );
  });

  it("在真实数据中覆盖单人、摄政、争议、空位和未校订状态", () => {
    expect(rulerSnapshot("polity-cn-ming", 1400).status).toBe("known");

    const qing = rulerSnapshot("polity-cn-qing", 1862);
    expect(qing.status).toBe("known");
    expect(qing.entries.map(({ reign }) => reign.role)).toEqual(["ruler", "regent", "regent"]);

    expect(rulerSnapshot("polity-cn-xia", -2070).status).toBe("disputed");
    expect(rulerSnapshot("polity-cn-western-zhou", -840).status).toBe("vacant");
    expect(rulerSnapshot("polity-cn-xia", -2069).status).toBe("unrecorded");
  });

  it("补全拜占庭帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-byzantine-empire", 80);

    const year1000 = rulerSnapshot("polity-byzantine-empire", 1000);
    expect(year1000.status).toBe("known");
    expect(year1000.entries.map(({ person }) => person.id)).toEqual(
      expect.arrayContaining(["person-byzantine-basil-ii", "person-byzantine-constantine-viii"])
    );

    expect(rulerSnapshot("polity-byzantine-empire", 1220).status).toBe("known");
    expect(
      rulerSnapshot("polity-byzantine-empire", 1453).entries.map(({ person }) => person.id)
    ).toContain("person-byzantine-constantine-xi");
  });

  it("补全阿拔斯哈里发详情与统治者", () => {
    expectWorldPolityDetails("polity-abbasid-caliphate", 37);
    expect(
      rulerSnapshot("polity-abbasid-caliphate", 800).entries.map(({ person }) => person.id)
    ).toContain("person-abbasid-harun-al-rashid");
    expect(
      rulerSnapshot("polity-abbasid-caliphate", 1258).entries.map(({ person }) => person.id)
    ).toContain("person-abbasid-al-mustasim");
  });

  it("补全神圣罗马帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-holy-roman-empire", 45);
    expect(
      rulerSnapshot("polity-holy-roman-empire", 1000).entries.map(({ person }) => person.id)
    ).toContain("person-hre-otto-iii");
    expect(
      rulerSnapshot("polity-holy-roman-empire", 1260).entries.map(({ person }) => person.id)
    ).toEqual(expect.arrayContaining(["person-hre-richard-of-cornwall", "person-hre-alfonso-x"]));
    expect(
      rulerSnapshot("polity-holy-roman-empire", 1320).entries.map(({ person }) => person.id)
    ).toEqual(expect.arrayContaining(["person-hre-louis-iv", "person-hre-frederick-the-fair"]));
    expect(
      rulerSnapshot("polity-holy-roman-empire", 1326).entries.find(
        ({ person }) => person.id === "person-hre-frederick-the-fair"
      )?.reign.role
    ).toBe("co-ruler");
    expect(
      rulerSnapshot("polity-holy-roman-empire", 1410).entries.map(({ person }) => person.id)
    ).toContain("person-hre-jobst-of-moravia");
    expect(
      rulerSnapshot("polity-holy-roman-empire", 1700).entries.map(({ person }) => person.id)
    ).toContain("person-hre-leopold-i");
    expect(rulerSnapshot("polity-holy-roman-empire", 1741).status).toBe("vacant");
    expect(
      rulerSnapshot("polity-holy-roman-empire", 1806).entries.map(({ person }) => person.id)
    ).toContain("person-hre-francis-ii");
  });

  it("补全朱罗帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-chola-empire", 20);
    expect(
      rulerSnapshot("polity-chola-empire", 1010).entries.map(({ person }) => person.id)
    ).toContain("person-chola-rajaraja-i");
    expect(
      rulerSnapshot("polity-chola-empire", 1070).entries.map(({ person }) => person.id)
    ).toContain("person-chola-kulottunga-i");
    expect(
      rulerSnapshot("polity-chola-empire", 1279).entries.map(({ person }) => person.id)
    ).toContain("person-chola-rajendra-iii");
  });

  it("补全高丽详情与统治者", () => {
    expectWorldPolityDetails("polity-goryeo", 11);
    expect(rulerSnapshot("polity-goryeo", 1000).status).toBe("known");
    expect(rulerSnapshot("polity-goryeo", 1000).entries.map(({ person }) => person.id)).toContain(
      "person-goryeo-mokjong"
    );
  });

  it("补全德川幕府详情与统治者", () => {
    expectWorldPolityDetails("polity-tokugawa-shogunate", 15);
    expect(rulerSnapshot("polity-tokugawa-shogunate", 1700).status).toBe("known");
    expect(
      rulerSnapshot("polity-tokugawa-shogunate", 1700).entries.map(({ person }) => person.id)
    ).toContain("person-tokugawa-tsunayoshi");
  });

  it("补全高棉帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-khmer-empire", 8);
    expect(rulerSnapshot("polity-khmer-empire", 1200).status).toBe("known");
    expect(
      rulerSnapshot("polity-khmer-empire", 1200).entries.map(({ person }) => person.id)
    ).toContain("person-khmer-jayavarman-vii");
  });

  it("补全满者伯夷详情与统治者", () => {
    expectWorldPolityDetails("polity-majapahit", 8);
    expect(rulerSnapshot("polity-majapahit", 1350).status).toBe("known");
    expect(
      rulerSnapshot("polity-majapahit", 1350).entries.map(({ person }) => person.id)
    ).toContain("person-majapahit-hayam-wuruk");
  });

  it("补全贵霜帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-kushan-empire", 6);
    expect(rulerSnapshot("polity-kushan-empire", 150).status).toBe("disputed");
    expect(
      rulerSnapshot("polity-kushan-empire", 150).entries.map(({ person }) => person.id)
    ).toContain("person-kushan-kanishka-i");
  });

  it("补全帖木儿帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-timurid-empire", 6);
    expect(rulerSnapshot("polity-timurid-empire", 1400).status).toBe("known");
    expect(
      rulerSnapshot("polity-timurid-empire", 1400).entries.map(({ person }) => person.id)
    ).toContain("person-timurid-timur");
  });

  it("补全孔雀帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-maurya-empire", 9);
    expect(rulerSnapshot("polity-maurya-empire", -250).status).toBe("disputed");
    expect(
      rulerSnapshot("polity-maurya-empire", -250).entries.map(({ person }) => person.id)
    ).toContain("person-maurya-ashoka");
  });

  it("补全莫卧儿帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-mughal-empire", 14);
    expect(rulerSnapshot("polity-mughal-empire", 1605).status).toBe("known");
    expect(
      rulerSnapshot("polity-mughal-empire", 1605).entries.map(({ person }) => person.id)
    ).toContain("person-mughal-akbar");
  });

  it("补全塞尔柱帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-seljuk-empire", 17);
    expect(rulerSnapshot("polity-seljuk-empire", 1072).status).toBe("known");
    expect(
      rulerSnapshot("polity-seljuk-empire", 1072).entries.map(({ person }) => person.id)
    ).toEqual(expect.arrayContaining(["person-seljuk-alp-arslan", "person-seljuk-malik-shah-i"]));
  });

  it("补全奥斯曼帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-ottoman-empire", 36);
    expect(rulerSnapshot("polity-ottoman-empire", 1453).status).toBe("known");
    expect(
      rulerSnapshot("polity-ottoman-empire", 1453).entries.map(({ person }) => person.id)
    ).toContain("person-ottoman-mehmed-ii");
  });

  it("补全法兰克王国详情与统治者", () => {
    expectWorldPolityDetails("polity-frankish-kingdom", 31);
    expect(rulerSnapshot("polity-frankish-kingdom", 800).status).toBe("known");
    expect(
      rulerSnapshot("polity-frankish-kingdom", 800).entries.map(({ person }) => person.id)
    ).toContain("person-frankish-charlemagne");
  });

  it("补全英格兰王国详情与统治者", () => {
    expectWorldPolityDetails("polity-kingdom-of-england", 47);
    expect(rulerSnapshot("polity-kingdom-of-england", 1066).status).toBe("known");
    expect(
      rulerSnapshot("polity-kingdom-of-england", 1066).entries.map(({ person }) => person.id)
    ).toEqual(expect.arrayContaining(["person-england-harold-ii", "person-england-william-i"]));
  });

  it("补全法蒂玛王朝详情与统治者", () => {
    expectWorldPolityDetails("polity-fatimid-caliphate", 14);
    expect(rulerSnapshot("polity-fatimid-caliphate", 1000).status).toBe("known");
    expect(
      rulerSnapshot("polity-fatimid-caliphate", 1000).entries.map(({ person }) => person.id)
    ).toContain("person-fatimid-al-hakim");
  });

  it("补全马里帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-mali-empire", 22);
    expect(rulerSnapshot("polity-mali-empire", 1350).status).toBe("known");
    expect(
      rulerSnapshot("polity-mali-empire", 1350).entries.map(({ person }) => person.id)
    ).toContain("person-mali-suleyman");
  });

  it("补全阿兹特克帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-aztec-empire", 8);
    expect(rulerSnapshot("polity-aztec-empire", 1500).status).toBe("known");
    expect(
      rulerSnapshot("polity-aztec-empire", 1500).entries.map(({ person }) => person.id)
    ).toContain("person-aztec-ahuitzotl");
  });

  it("补全印加帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-inca-empire", 8);
    expect(rulerSnapshot("polity-inca-empire", 1500).status).toBe("known");
    expect(
      rulerSnapshot("polity-inca-empire", 1500).entries.map(({ person }) => person.id)
    ).toContain("person-inca-huayna-capac");
  });

  it("补全萨珊帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-sasanian-empire", 20);
    expect(rulerSnapshot("polity-sasanian-empire", 500).status).toBe("known");
    expect(
      rulerSnapshot("polity-sasanian-empire", 500).entries.map(({ person }) => person.id)
    ).toContain("person-sasanian-kavad-i");
    expect(activePlaces("polity-sasanian-empire", 500)).toEqual(["Ctesiphon"]);
  });

  it("补全遮娄其王朝详情与统治者", () => {
    expectWorldPolityDetails("polity-chalukya-dynasty", 8);
    expect(rulerSnapshot("polity-chalukya-dynasty", 630).status).toBe("known");
    expect(
      rulerSnapshot("polity-chalukya-dynasty", 630).entries.map(({ person }) => person.id)
    ).toContain("person-chalukya-pulakesi-ii");
    expect(activePlaces("polity-chalukya-dynasty", 630)).toEqual(["Badami"]);
  });

  it("补全倭马亚哈里发国详情与统治者", () => {
    expectWorldPolityDetails("polity-umayyad-caliphate", 14);
    expect(rulerSnapshot("polity-umayyad-caliphate", 710).status).toBe("known");
    expect(
      rulerSnapshot("polity-umayyad-caliphate", 710).entries.map(({ person }) => person.id)
    ).toContain("person-umayyad-al-walid-i");
    expect(activePlaces("polity-umayyad-caliphate", 710)).toEqual(["Damascus"]);
    expect(activePlaces("polity-umayyad-caliphate", 745)).toEqual(["Harran"]);
  });

  it("补全萨法维王朝详情与统治者", () => {
    expectWorldPolityDetails("polity-safavid-iran", 11);
    expect(rulerSnapshot("polity-safavid-iran", 1600).status).toBe("known");
    expect(
      rulerSnapshot("polity-safavid-iran", 1600).entries.map(({ person }) => person.id)
    ).toContain("person-safavid-abbas-i");
    expect(activePlaces("polity-safavid-iran", 1600)).toEqual(["Isfahan"]);
  });

  it("补全笈多帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-gupta-empire", 11);
    expect(rulerSnapshot("polity-gupta-empire", 400).status).toBe("known");
    expect(
      rulerSnapshot("polity-gupta-empire", 400).entries.map(({ person }) => person.id)
    ).toContain("person-gupta-chandragupta-ii");
    expect(activePlaces("polity-gupta-empire", 400)).toEqual(["Pataliputra"]);
  });

  it("补全德里苏丹国详情与统治者", () => {
    expectWorldPolityDetails("polity-delhi-sultanate", 33);
    expect(rulerSnapshot("polity-delhi-sultanate", 1300).status).toBe("known");
    expect(
      rulerSnapshot("polity-delhi-sultanate", 1300).entries.map(({ person }) => person.id)
    ).toContain("person-delhi-sultanate-ala-ud-din-khalji");
    expect(activePlaces("polity-delhi-sultanate", 1300)).toEqual(["Delhi"]);
  });

  it("补全蒲甘王朝详情与统治者", () => {
    expectWorldPolityDetails("polity-pagan-kingdom", 10);
    expect(rulerSnapshot("polity-pagan-kingdom", 1100).status).toBe("known");
    expect(
      rulerSnapshot("polity-pagan-kingdom", 1100).entries.map(({ person }) => person.id)
    ).toContain("person-pagan-kyansittha");
    expect(activePlaces("polity-pagan-kingdom", 1100)).toEqual(["Pagan"]);
  });

  it("补全占婆王国详情与统治者", () => {
    expectWorldPolityDetails("polity-champa-kingdom", 9);
    expect(rulerSnapshot("polity-champa-kingdom", 1100).status).toBe("known");
    expect(
      rulerSnapshot("polity-champa-kingdom", 1100).entries.map(({ person }) => person.id)
    ).toContain("person-champa-jaya-paramesvaravarman-i");
    expect(activePlaces("polity-champa-kingdom", 1100)).toEqual(["Vijaya"]);
  });

  it("补全素可泰王国详情与统治者", () => {
    expectWorldPolityDetails("polity-sukhothai-kingdom", 8);
    expect(rulerSnapshot("polity-sukhothai-kingdom", 1300).status).toBe("known");
    expect(
      rulerSnapshot("polity-sukhothai-kingdom", 1300).entries.map(({ person }) => person.id)
    ).toContain("person-sukhothai-loethai");
    expect(activePlaces("polity-sukhothai-kingdom", 1300)).toEqual(["Sukhothai"]);
  });

  it("补全阿瑜陀耶王国详情与统治者", () => {
    expectWorldPolityDetails("polity-ayutthaya-kingdom", 12);
    expect(rulerSnapshot("polity-ayutthaya-kingdom", 1600).status).toBe("known");
    expect(
      rulerSnapshot("polity-ayutthaya-kingdom", 1600).entries.map(({ person }) => person.id)
    ).toContain("person-ayutthaya-naresuan");
    expect(activePlaces("polity-ayutthaya-kingdom", 1600)).toEqual(["Ayutthaya"]);
  });

  it("补全第一保加利亚帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-first-bulgarian-empire", 10);
    expect(rulerSnapshot("polity-first-bulgarian-empire", 900).status).toBe("known");
    expect(
      rulerSnapshot("polity-first-bulgarian-empire", 900).entries.map(({ person }) => person.id)
    ).toContain("person-first-bulgarian-simeon-i");
    expect(activePlaces("polity-first-bulgarian-empire", 900)).toEqual(["Preslav"]);
  });

  it("补全基辅罗斯详情与统治者", () => {
    expectWorldPolityDetails("polity-kievan-rus", 12);
    expect(rulerSnapshot("polity-kievan-rus", 1050).status).toBe("known");
    expect(
      rulerSnapshot("polity-kievan-rus", 1050).entries.map(({ person }) => person.id)
    ).toContain("person-kievan-rus-yaroslav-i");
    expect(activePlaces("polity-kievan-rus", 1050)).toEqual(["Kiev"]);
  });

  it("补全卡斯蒂利亚王国详情与统治者", () => {
    expectWorldPolityDetails("polity-kingdom-of-castile", 10);
    expect(rulerSnapshot("polity-kingdom-of-castile", 1200).status).toBe("known");
    expect(
      rulerSnapshot("polity-kingdom-of-castile", 1200).entries.map(({ person }) => person.id)
    ).toContain("person-castile-alfonso-viii");
    expect(activePlaces("polity-kingdom-of-castile", 1200)).toEqual(["Toledo"]);
  });

  it("补全莱昂王国详情与统治者", () => {
    expectWorldPolityDetails("polity-kingdom-of-leon", 10);
    expect(rulerSnapshot("polity-kingdom-of-leon", 1200).status).toBe("known");
    expect(
      rulerSnapshot("polity-kingdom-of-leon", 1200).entries.map(({ person }) => person.id)
    ).toContain("person-leon-alfonso-ix");
    expect(activePlaces("polity-kingdom-of-leon", 1200)).toEqual(["León"]);
  });

  it("补全埃塞俄比亚帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-ethiopian-empire", 8);
    expect(rulerSnapshot("polity-ethiopian-empire", 1400).status).toBe("known");
    expect(
      rulerSnapshot("polity-ethiopian-empire", 1400).entries.map(({ person }) => person.id)
    ).toContain("person-ethiopian-dawit-i");
    expect(activePlaces("polity-ethiopian-empire", 1700)).toEqual(["Gondar"]);
  });

  it("补全桑海帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-songhai-empire", 5);
    expect(rulerSnapshot("polity-songhai-empire", 1500).status).toBe("known");
    expect(
      rulerSnapshot("polity-songhai-empire", 1500).entries.map(({ person }) => person.id)
    ).toContain("person-songhai-askia-muhammad");
    expect(activePlaces("polity-songhai-empire", 1500)).toEqual(["Gao"]);
  });

  it("补全大津巴布韦王国详情与资料缺载说明", () => {
    expectWorldPolityDetails("polity-great-zimbabwe", 0);
    expect(rulerSnapshot("polity-great-zimbabwe", 1300).status).toBe("vacant");
    expect(activePlaces("polity-great-zimbabwe", 1300)).toEqual(["Great Zimbabwe"]);
  });

  it("补全玛雅城邦详情与代表性统治者", () => {
    expectWorldPolityDetails("polity-maya-city-states", 4);
    expect(rulerSnapshot("polity-maya-city-states", 680).status).toBe("known");
    expect(
      rulerSnapshot("polity-maya-city-states", 680).entries.map(({ person }) => person.id)
    ).toEqual(expect.arrayContaining(["person-maya-pakal", "person-maya-yuknoom-great"]));
    expect(activePlaces("polity-maya-city-states", 680)).toEqual(["Tikal"]);
  });

  it("补全托尔特克详情与统治者", () => {
    expectWorldPolityDetails("polity-toltec-state", 2);
    expect(rulerSnapshot("polity-toltec-state", 1000).status).toBe("vacant");
    expect(rulerSnapshot("polity-toltec-state", 940).status).toBe("disputed");
    expect(
      rulerSnapshot("polity-toltec-state", 940).entries.map(({ person }) => person.id)
    ).toContain("person-toltec-quetzalcoatl");
    expect(activePlaces("polity-toltec-state", 1000)).toEqual(["Tula"]);
  });

  it("补全阿克苏姆王国详情与统治者", () => {
    expectWorldPolityDetails("polity-aksumite-kingdom", 3);
    expect(rulerSnapshot("polity-aksumite-kingdom", 340).status).toBe("known");
    expect(
      rulerSnapshot("polity-aksumite-kingdom", 340).entries.map(({ person }) => person.id)
    ).toContain("person-aksum-ezana");
    expect(activePlaces("polity-aksumite-kingdom", 340)).toEqual(["Axum"]);
  });

  it("补全穆塔帕帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-mutapa-empire", 4);
    expect(rulerSnapshot("polity-mutapa-empire", 1500).status).toBe("disputed");
    expect(
      rulerSnapshot("polity-mutapa-empire", 1500).entries.map(({ person }) => person.id)
    ).toContain("person-mutapa-matope");
    expect(activePlaces("polity-mutapa-empire", 1500)).toEqual(["Zvongombe"]);
  });

  it("补全特奥蒂瓦坎详情与资料缺载说明", () => {
    expectWorldPolityDetails("polity-teotihuacan-state", 0);
    expect(rulerSnapshot("polity-teotihuacan-state", 400).status).toBe("vacant");
    expect(activePlaces("polity-teotihuacan-state", 400)).toEqual(["Teotihuacan"]);
  });

  it("补全卡涅姆-博尔努帝国详情与统治者", () => {
    expectWorldPolityDetails("polity-kanem-bornu-empire", 4);
    expect(rulerSnapshot("polity-kanem-bornu-empire", 1580).status).toBe("known");
    expect(
      rulerSnapshot("polity-kanem-bornu-empire", 1580).entries.map(({ person }) => person.id)
    ).toContain("person-kanem-bornu-idris-alauma");
    expect(activePlaces("polity-kanem-bornu-empire", 1580)).toEqual(["Ngazargamu"]);
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
    expect(rulerSnapshot("polity-cn-southern-ming", 1646).entries.length).toBeGreaterThan(0);
  });

  it("扩展萨曼、西辽与花剌子模三个中亚政权的详情和分期点位", () => {
    expectPolityDetails([
      "polity-samanid-empire",
      "polity-qara-khitai",
      "polity-khwarazmian-empire"
    ]);

    expect(
      rulerSnapshot("polity-samanid-empire", 820).entries.map(({ person }) => person.id)
    ).toEqual(
      expect.arrayContaining([
        "person-samanid-nuh-ibn-asad",
        "person-samanid-ahmad-ibn-asad",
        "person-samanid-yahya-ibn-asad",
        "person-samanid-ilyas-ibn-asad"
      ])
    );
    expect(
      rulerSnapshot("polity-samanid-empire", 900).entries.map(({ person }) => person.id)
    ).toEqual(["person-samanid-ismail-i"]);
    expect(activePlaces("polity-samanid-empire", 850)).toEqual(["Samarkand"]);
    expect(activePlaces("polity-samanid-empire", 900)).toEqual(["Bukhara"]);

    expect(
      rulerSnapshot("polity-qara-khitai", 1145).entries.map(({ person }) => person.id)
    ).toEqual(["person-qara-khitai-xiao-tabuyan"]);
    expect(
      rulerSnapshot("polity-qara-khitai", 1215).entries.map(({ person }) => person.id)
    ).toEqual(["person-qara-khitai-kuchlug"]);
    expect(activePlaces("polity-qara-khitai", 1130)).toEqual([]);
    expect(activePlaces("polity-qara-khitai", 1150)).toEqual(["Balasagun"]);

    expect(
      rulerSnapshot("polity-khwarazmian-empire", 1180).entries.map(({ person }) => person.id)
    ).toEqual(["person-khwarazmian-tekish", "person-khwarazmian-sultan-shah"]);
    expect(activePlaces("polity-khwarazmian-empire", 1200)).toEqual(["Gurganj"]);
    expect(activePlaces("polity-khwarazmian-empire", 1215)).toEqual(["Samarkand"]);
    expect(activePlaces("polity-khwarazmian-empire", 1223)).toEqual([]);
    expect(activePlaces("polity-khwarazmian-empire", 1226)).toEqual(["Tabriz"]);
  });

  it("扩展库施、基尔瓦、祖鲁与北恩德贝莱的详情和分期点位", () => {
    expectWorldPolityDetails("polity-kingdom-of-kush", 8);
    expectWorldPolityDetails("polity-kilwa-sultanate", 4);
    expectWorldPolityDetails("polity-zulu-kingdom", 4);
    expectWorldPolityDetails("polity-ndebele-kingdom", 2);

    expect(
      rulerSnapshot("polity-kingdom-of-kush", -690).entries.map(({ person }) => person.id)
    ).toEqual(["person-kush-taharqa"]);
    expect(
      rulerSnapshot("polity-kingdom-of-kush", 10).entries.map(({ person }) => person.id)
    ).toEqual(["person-kush-natakamani", "person-kush-amanitore"]);
    expect(activePlaces("polity-kingdom-of-kush", -500)).toEqual(["Napata"]);
    expect(activePlaces("polity-kingdom-of-kush", -100)).toEqual(["Meroe"]);

    expect(
      rulerSnapshot("polity-kilwa-sultanate", 1320).entries.map(({ person }) => person.id)
    ).toEqual(["person-kilwa-al-hasan-ibn-sulaiman"]);
    expect(activePlaces("polity-kilwa-sultanate", 1320)).toEqual(["Kilwa Kisiwani"]);

    expect(
      rulerSnapshot("polity-zulu-kingdom", 1830).entries.map(({ person }) => person.id)
    ).toEqual(["person-zulu-dingane"]);
    expect(activePlaces("polity-zulu-kingdom", 1830)).toEqual(["Ulundi"]);

    expect(
      rulerSnapshot("polity-ndebele-kingdom", 1850).entries.map(({ person }) => person.id)
    ).toEqual(["person-ndebele-mzilikazi"]);
    expect(rulerSnapshot("polity-ndebele-kingdom", 1869).status).toBe("unrecorded");
    expect(
      rulerSnapshot("polity-ndebele-kingdom", 1875).entries.map(({ person }) => person.id)
    ).toEqual(["person-ndebele-lobengula"]);
    expect(activePlaces("polity-ndebele-kingdom", 1830)).toEqual([]);
    expect(activePlaces("polity-ndebele-kingdom", 1850)).toEqual(["Bulawayo"]);
  });

  it("扩展统一新罗、朝鲜王朝、足利幕府与琉球王国的详情和点位", () => {
    expectWorldPolityDetails("polity-unified-silla", 10);
    expectWorldPolityDetails("polity-joseon-dynasty", 14);
    expectWorldPolityDetails("polity-ashikaga-shogunate", 12);
    expectWorldPolityDetails("polity-ryukyu-kingdom", 8);

    expect(
      rulerSnapshot("polity-unified-silla", 670).entries.map(({ person }) => person.id)
    ).toEqual(["person-unified-silla-munmu"]);
    expect(
      rulerSnapshot("polity-unified-silla", 930).entries.map(({ person }) => person.id)
    ).toEqual(["person-unified-silla-gyeongsun"]);
    expect(activePlaces("polity-unified-silla", 800)).toEqual(["Gyeongju"]);

    expect(
      rulerSnapshot("polity-joseon-dynasty", 1420).entries.map(({ person }) => person.id)
    ).toEqual(["person-joseon-sejong"]);
    expect(
      rulerSnapshot("polity-joseon-dynasty", 1592).entries.map(({ person }) => person.id)
    ).toEqual(["person-joseon-seonjo"]);
    expect(activePlaces("polity-joseon-dynasty", 1393)).toEqual(["Gaegyeong"]);
    expect(activePlaces("polity-joseon-dynasty", 1500)).toEqual(["Hanseong"]);

    expect(
      rulerSnapshot("polity-ashikaga-shogunate", 1400).entries.map(({ person }) => person.id)
    ).toEqual(["person-ashikaga-yoshimochi"]);
    expect(
      rulerSnapshot("polity-ashikaga-shogunate", 1500).entries.map(({ person }) => person.id)
    ).toEqual(["person-ashikaga-yoshizumi"]);
    expect(activePlaces("polity-ashikaga-shogunate", 1500)).toEqual(["Kyoto"]);

    expect(
      rulerSnapshot("polity-ryukyu-kingdom", 1500).entries.map(({ person }) => person.id)
    ).toEqual(["person-ryukyu-sho-shin"]);
    expect(
      rulerSnapshot("polity-ryukyu-kingdom", 1610).entries.map(({ person }) => person.id)
    ).toEqual(["person-ryukyu-sho-nei"]);
    expect(activePlaces("polity-ryukyu-kingdom", 1700)).toEqual(["Shuri"]);
  });

  it("扩展南亚、美洲与北非时间纵深政权的详情和分期点位", () => {
    expectWorldPolityDetails("polity-vijayanagara-empire", 11);
    expectWorldPolityDetails("polity-maratha-empire", 9);
    expectWorldPolityDetails("polity-chimu-empire", 4);
    expectWorldPolityDetails("polity-purepecha-empire", 5);
    expectWorldPolityDetails("polity-numidia", 6);
    expectWorldPolityDetails("polity-almohad-caliphate", 9);

    expect(
      rulerSnapshot("polity-vijayanagara-empire", 1515).entries.map(({ person }) => person.id)
    ).toEqual(["person-vijayanagara-krishnadevaraya"]);
    expect(
      rulerSnapshot("polity-vijayanagara-empire", 1550).entries.map(({ person }) => person.id)
    ).toEqual(["person-vijayanagara-sadasiva", "person-vijayanagara-rama-raya"]);
    expect(activePlaces("polity-vijayanagara-empire", 1500)).toEqual(["Vijayanagara (Hampi)"]);
    expect(activePlaces("polity-vijayanagara-empire", 1600)).toEqual(["Penukonda"]);

    expect(
      rulerSnapshot("polity-maratha-empire", 1675).entries.map(({ person }) => person.id)
    ).toEqual(["person-maratha-shivaji"]);
    expect(
      rulerSnapshot("polity-maratha-empire", 1725).entries.map(({ person }) => person.id)
    ).toEqual(["person-maratha-shahu", "person-maratha-baji-rao-i"]);
    expect(activePlaces("polity-maratha-empire", 1680)).toEqual(["Raigad"]);
    expect(activePlaces("polity-maratha-empire", 1750)).toEqual(["Pune"]);

    expect(
      rulerSnapshot("polity-chimu-empire", 1360).entries.map(({ person }) => person.id)
    ).toEqual(["person-chimu-nancempinco"]);
    expect(
      rulerSnapshot("polity-chimu-empire", 1460).entries.map(({ person }) => person.id)
    ).toEqual(["person-chimu-minchancaman"]);
    expect(activePlaces("polity-chimu-empire", 1400)).toEqual(["Chan Chan"]);

    expect(
      rulerSnapshot("polity-purepecha-empire", 1460).entries.map(({ person }) => person.id)
    ).toEqual(["person-purepecha-tzitzipandacuare"]);
    expect(
      rulerSnapshot("polity-purepecha-empire", 1525).entries.map(({ person }) => person.id)
    ).toEqual(["person-purepecha-tangaxoan-ii"]);
    expect(activePlaces("polity-purepecha-empire", 1400)).toEqual(["Patzcuaro"]);
    expect(activePlaces("polity-purepecha-empire", 1500)).toEqual(["Tzintzuntzan"]);

    expect(rulerSnapshot("polity-numidia", -200).entries.map(({ person }) => person.id)).toEqual([
      "person-numidia-masinissa"
    ]);
    expect(rulerSnapshot("polity-numidia", -100).entries.map(({ person }) => person.id)).toEqual([
      "person-numidia-gauda"
    ]);
    expect(activePlaces("polity-numidia", -100)).toEqual(["Cirta"]);

    expect(
      rulerSnapshot("polity-almohad-caliphate", 1185).entries.map(({ person }) => person.id)
    ).toEqual(["person-almohad-yaqub-al-mansur"]);
    expect(
      rulerSnapshot("polity-almohad-caliphate", 1250).entries.map(({ person }) => person.id)
    ).toEqual(["person-almohad-umar-al-murtada"]);
    expect(activePlaces("polity-almohad-caliphate", 1140)).toEqual(["Tinmel"]);
    expect(activePlaces("polity-almohad-caliphate", 1200)).toEqual(["Marrakesh"]);
  });

  it("为全部七十一个中国政权提供统治者详情", () => {
    const chinesePolityIds = data.entities
      .filter(({ entityKind, historicalRegionIds }) => {
        return entityKind === "polity" && historicalRegionIds.includes("region-china");
      })
      .map(({ id }) => id);

    expect(chinesePolityIds).toHaveLength(71);
    expect(
      chinesePolityIds.every((id) => data.reigns.some(({ polityId }) => polityId === id))
    ).toBe(true);
  });
});
