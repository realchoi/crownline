import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildDataCoverageReport } from "../src/data/coverageReport";
import { isYearInPeriods } from "../src/domain/chronology";

const data = await loadSourceData();
const report = buildDataCoverageReport(data);
const activePlaces = (polityId: string, year: number) =>
  data.geographicSnapshots
    .filter((snapshot) => snapshot.polityId === polityId && isYearInPeriods(year, snapshot.periods))
    .map(({ placeName }) => placeName)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));

describe("第二批点位证据与小型年份缺口校订", () => {
  it("隋581—582年保留旧长安，583年切换到大兴城", () => {
    expect(activePlaces("polity-cn-sui", 581)).toEqual(["长安旧城"]);
    expect(activePlaces("polity-cn-sui", 582)).toEqual(["长安旧城"]);
    expect(activePlaces("polity-cn-sui", 583)).toEqual(["大兴城"]);
  });

  it("唐904年并列迁都年两地，905—907年只显示洛阳", () => {
    expect(activePlaces("polity-cn-tang", 904)).toEqual(["洛阳", "长安"]);
    expect(activePlaces("polity-cn-tang", 905)).toEqual(["洛阳"]);
    expect(activePlaces("polity-cn-tang", 907)).toEqual(["洛阳"]);
  });

  it("元朝上都覆盖国号建立年并与大都保留双都语义", () => {
    expect(activePlaces("polity-cn-yuan", 1271)).toEqual(["上都"]);
    expect(activePlaces("polity-cn-yuan", 1272)).toEqual(["大都", "上都"]);
    expect(activePlaces("polity-cn-yuan", 1364)).toEqual(["大都", "上都"]);
    expect(activePlaces("polity-cn-yuan", 1365)).toEqual(["大都"]);
  });

  it.each(["polity-cn-sui", "polity-cn-tang", "polity-cn-yuan"])(
    "%s 的地理年份覆盖达到100%",
    (id) => {
      expect(
        report.temporalCoverage.polities.find(({ entityId }) => entityId === id)?.geography
      ).toMatchObject({ unknownYears: 0, coveredPercentage: 100 });
    }
  );

  it("继续保留流动政权阶段和缺少稳定中心证据的年份", () => {
    expect(
      report.temporalCoverage.polities.find(
        ({ entityId }) => entityId === "polity-cn-southern-ming"
      )?.geography.unknownYears
    ).toBe(4);
    expect(
      report.temporalCoverage.polities.find(
        ({ entityId }) => entityId === "polity-cn-southern-song"
      )?.geography.unknownYears
    ).toBe(2);
    expect(
      report.temporalCoverage.polities.find(
        ({ entityId }) => entityId === "polity-khwarazmian-empire"
      )?.geography.unknownYears
    ).toBe(4);
  });

  it("三条新增点位都具备可定位来源和限制说明", () => {
    const ids = ["geo-sui-old-changan", "geo-tang-luoyang", "geo-yuan-shangdu"];
    for (const id of ids) {
      const snapshot = data.geographicSnapshots.find(({ id: candidateId }) => candidateId === id)!;
      expect(
        snapshot.sourceRefs.every(({ locator }) => Boolean(locator?.trim())),
        id
      ).toBe(true);
      expect(snapshot.positionNote, id).toMatch(/不表示/);
    }
  });
});
