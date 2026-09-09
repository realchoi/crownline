import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import { selectRulerSnapshot } from "../src/domain/rulerSnapshot";
import { buildPolityTemporalCoverage } from "../src/domain/temporalCoverage";

const data = await loadSourceData();
const details = buildGeneratedArtifacts(data).details;

function rulerIdsAt(entityId: string, year: number): string[] {
  const entity = data.entities.find(({ id }) => id === entityId);
  const detail = details.get(entityId);
  if (!entity || !detail) throw new Error(`缺少测试详情 ${entityId}`);
  return selectRulerSnapshot(entity, detail, year).entries.map(({ person }) => person.id);
}

describe("东亚与东南亚统治者序列深度", () => {
  it.each([
    ["polity-joseon-dynasty", 26],
    ["polity-ryukyu-kingdom", 25],
    ["polity-ayutthaya-kingdom", 33]
  ] as const)("%s 的存续年份均有已校订任期记录", (entityId, reignCount) => {
    const entity = data.entities.find(({ id }) => id === entityId)!;
    const reigns = data.reigns.filter(({ polityId }) => polityId === entityId);
    const vacancies = data.reignVacancies.filter(({ polityId }) => polityId === entityId);
    const geography = data.geographicSnapshots.filter(({ polityId }) => polityId === entityId);

    expect(reigns).toHaveLength(reignCount);
    expect(new Set(reigns.map(({ personId }) => personId)).size).toBe(reignCount);
    expect(
      buildPolityTemporalCoverage(entity, reigns, vacancies, geography).rulerDetails
    ).toMatchObject({
      unknownPeriods: [],
      unknownYears: 0,
      rulerCoveragePercentage: 100
    });
  });

  it("朝鲜王朝在原抽样空档年份返回已校订国王", () => {
    expect(rulerIdsAt("polity-joseon-dynasty", 1399)).toEqual(["person-joseon-jeongjong"]);
    expect(rulerIdsAt("polity-joseon-dynasty", 1451)).toEqual(["person-joseon-munjong"]);
    expect(rulerIdsAt("polity-joseon-dynasty", 1550)).toEqual(["person-joseon-myeongjong"]);
    expect(rulerIdsAt("polity-joseon-dynasty", 1810)).toEqual(["person-joseon-sunjo"]);
  });

  it("琉球王国在两尚氏原抽样空档年份返回已校订国王", () => {
    expect(rulerIdsAt("polity-ryukyu-kingdom", 1445)).toEqual(["person-ryukyu-sho-shitatsu"]);
    expect(rulerIdsAt("polity-ryukyu-kingdom", 1550)).toEqual(["person-ryukyu-sho-sei"]);
    expect(rulerIdsAt("polity-ryukyu-kingdom", 1690)).toEqual(["person-ryukyu-sho-tei"]);
    expect(rulerIdsAt("polity-ryukyu-kingdom", 1805)).toEqual(["person-ryukyu-sho-ko"]);
  });

  it("阿瑜陀耶王国在原抽样空档年份返回已校订国王", () => {
    expect(rulerIdsAt("polity-ayutthaya-kingdom", 1394)).toEqual(["person-ayutthaya-ramesuan"]);
    expect(rulerIdsAt("polity-ayutthaya-kingdom", 1500)).toEqual([
      "person-ayutthaya-ramathibodi-ii"
    ]);
    expect(rulerIdsAt("polity-ayutthaya-kingdom", 1625)).toEqual(["person-ayutthaya-songtham"]);
    expect(rulerIdsAt("polity-ayutthaya-kingdom", 1710)).toEqual(["person-ayutthaya-thai-sa"]);
  });

  it("在年度粒度下保留同一交接年内先后在位的统治者", () => {
    expect(rulerIdsAt("polity-joseon-dynasty", 1452)).toEqual(
      expect.arrayContaining(["person-joseon-munjong", "person-joseon-danjong"])
    );
    expect(rulerIdsAt("polity-ryukyu-kingdom", 1477)).toEqual(
      expect.arrayContaining(["person-ryukyu-sho-sen-i", "person-ryukyu-sho-shin"])
    );
    expect(rulerIdsAt("polity-ayutthaya-kingdom", 1388)).toEqual(
      expect.arrayContaining([
        "person-ayutthaya-borommaracha-i",
        "person-ayutthaya-thong-lan",
        "person-ayutthaya-ramesuan"
      ])
    );
  });

  it("采用机构王表修正原抽样记录中的错误端点", () => {
    expect(data.reigns.find(({ id }) => id === "reign-ryukyu-sho-nei")?.periods).toMatchObject([
      { start: { year: 1589 }, end: { year: 1620 } }
    ]);
    expect(data.reigns.find(({ id }) => id === "reign-ryukyu-sho-kei")?.periods).toMatchObject([
      { start: { year: 1713 }, end: { year: 1751 } }
    ]);
    expect(
      data.reigns.find(({ id }) => id === "reign-ayutthaya-ekathotsarot")?.periods
    ).toMatchObject([{ start: { year: 1605 }, end: { year: 1610 } }]);
    expect(
      data.reigns.find(({ id }) => id === "reign-ayutthaya-prasat-thong")?.periods
    ).toMatchObject([{ start: { year: 1629 }, end: { year: 1656 } }]);
  });
});
