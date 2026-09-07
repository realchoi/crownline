import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { isYearInPeriods } from "../src/domain/chronology";
import { buildDataCoverageReport } from "../src/data/coverageReport";

const data = await loadSourceData();
const report = buildDataCoverageReport(data);
const activePlaces = (polityId: string, year: number) =>
  data.geographicSnapshots
    .filter((snapshot) => snapshot.polityId === polityId && isYearInPeriods(year, snapshot.periods))
    .map(({ placeName }) => placeName)
    .sort();

describe("首批按年份地理缺口校订", () => {
  it("西凉迁都和返回敦煌分段展示，转折年按年内存在保留两点", () => {
    expect(activePlaces("polity-cn-western-liang", 400)).toEqual(["敦煌"]);
    expect(activePlaces("polity-cn-western-liang", 405)).toEqual(["敦煌", "酒泉"]);
    expect(activePlaces("polity-cn-western-liang", 410)).toEqual(["酒泉"]);
    expect(activePlaces("polity-cn-western-liang", 420)).toEqual(["敦煌", "酒泉"]);
    expect(activePlaces("polity-cn-western-liang", 421)).toEqual(["敦煌"]);
    expect(activePlaces("polity-cn-western-liang", 422)).toEqual([]);
  });

  it("南明福州仅适用于隆武阶段，不外推到其他南明年份", () => {
    expect(activePlaces("polity-cn-southern-ming", 1644)).toEqual(["南京"]);
    expect(activePlaces("polity-cn-southern-ming", 1645)).toEqual(["南京", "福州"]);
    expect(activePlaces("polity-cn-southern-ming", 1646)).toEqual(["福州"]);
    expect(activePlaces("polity-cn-southern-ming", 1647)).toEqual([]);
  });

  it("前燕蓟城阶段不填补尚未校订的邺城阶段", () => {
    expect(activePlaces("polity-cn-former-yan", 349)).toEqual(["龙城"]);
    expect(activePlaces("polity-cn-former-yan", 350)).toEqual(["蓟城"]);
    expect(activePlaces("polity-cn-former-yan", 357)).toEqual(["蓟城"]);
    expect(activePlaces("polity-cn-former-yan", 358)).toEqual([]);
  });

  it.each([
    ["polity-cn-western-liang", 22, 0],
    ["polity-cn-southern-ming", 3, 16],
    ["polity-cn-former-yan", 16, 18],
    ["polity-cn-western-qin", 7, 32],
    ["polity-holy-roman-empire", 63, 782]
  ])("%s 的年份覆盖与明确保留缺口一致", (id, coveredYears, unknownYears) => {
    expect(
      report.temporalCoverage.polities.find(({ entityId }) => entityId === id)?.geography
    ).toMatchObject({ coveredYears, unknownYears });
  });

  it("所有本批新增或修改记录都有可定位的历史与现代坐标来源", () => {
    const ids = [
      "geo-western-liang-dunhuang",
      "geo-western-liang-jiuquan",
      "geo-southern-ming-fuzhou",
      "geo-former-yan-ji"
    ];
    for (const id of ids) {
      const snapshot = data.geographicSnapshots.find((record) => record.id === id)!;
      expect(snapshot.positionPrecision).toBe("regional");
      expect(snapshot.sourceRefs.every(({ locator }) => Boolean(locator?.trim()))).toBe(true);
      const sources = snapshot.sourceRefs.map(({ sourceId }) =>
        data.sources.find(({ id }) => id === sourceId)!
      );
      expect(sources.some(({ sourceType }) => sourceType === "dataset")).toBe(true);
      expect(sources.some(({ sourceType }) => sourceType === "institutional")).toBe(true);
      expect(
        sources.every(({ url, accessedAt }) => Boolean(url) && accessedAt === "2026-09-07")
      ).toBe(true);
    }
  });
});
