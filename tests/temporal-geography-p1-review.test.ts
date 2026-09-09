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

describe("第二批按年份地理缺口校订", () => {
  it("前燕按棘城、龙城、蓟城和邺城迁都节点闭区间展示", () => {
    expect(activePlaces("polity-cn-former-yan", 336)).toEqual([]);
    expect(activePlaces("polity-cn-former-yan", 337)).toEqual(["棘城"]);
    expect(activePlaces("polity-cn-former-yan", 341)).toEqual(["棘城"]);
    expect(activePlaces("polity-cn-former-yan", 342)).toEqual(["棘城", "龙城"]);
    expect(activePlaces("polity-cn-former-yan", 357)).toEqual(["蓟城", "邺城"]);
    expect(activePlaces("polity-cn-former-yan", 358)).toEqual(["邺城"]);
    expect(activePlaces("polity-cn-former-yan", 370)).toEqual(["邺城"]);
    expect(activePlaces("polity-cn-former-yan", 371)).toEqual([]);
  });

  it("南明只补有连续驻地证据的阶段并保留流动与拘押年份缺口", () => {
    expect(activePlaces("polity-cn-southern-ming", 1647)).toEqual(["桂林"]);
    expect(activePlaces("polity-cn-southern-ming", 1648)).toEqual([]);
    expect(activePlaces("polity-cn-southern-ming", 1649)).toEqual(["南宁"]);
    expect(activePlaces("polity-cn-southern-ming", 1651)).toEqual(["南宁"]);
    expect(activePlaces("polity-cn-southern-ming", 1652)).toEqual(["安龙"]);
    expect(activePlaces("polity-cn-southern-ming", 1656)).toEqual(["安龙", "昆明"]);
    expect(activePlaces("polity-cn-southern-ming", 1659)).toEqual(["昆明"]);
    expect(activePlaces("polity-cn-southern-ming", 1660)).toEqual([]);
    expect(activePlaces("polity-cn-southern-ming", 1662)).toEqual([]);
  });

  it("西秦两段存续分别展示迁都节点且不跨越401—408年中断", () => {
    expect(activePlaces("polity-cn-western-qin", 384)).toEqual([]);
    expect(activePlaces("polity-cn-western-qin", 385)).toEqual(["勇士城"]);
    expect(activePlaces("polity-cn-western-qin", 388)).toEqual(["金城", "勇士城"]);
    expect(activePlaces("polity-cn-western-qin", 394)).toEqual(["金城"]);
    expect(activePlaces("polity-cn-western-qin", 395)).toEqual(["金城", "苑川"]);
    expect(activePlaces("polity-cn-western-qin", 400)).toEqual(["苑川"]);
    for (let year = 401; year <= 408; year += 1) {
      expect(activePlaces("polity-cn-western-qin", year)).toEqual([]);
    }
    expect(activePlaces("polity-cn-western-qin", 409)).toEqual(["度坚山", "苑川"]);
    expect(activePlaces("polity-cn-western-qin", 410)).toEqual(["苑川"]);
    expect(activePlaces("polity-cn-western-qin", 412)).toEqual(["枹罕", "谭郊", "苑川"]);
    expect(activePlaces("polity-cn-western-qin", 429)).toEqual(["枹罕"]);
    expect(activePlaces("polity-cn-western-qin", 430)).toEqual(["南安"]);
    expect(activePlaces("polity-cn-western-qin", 431)).toEqual(["南安"]);
    expect(activePlaces("polity-cn-western-qin", 432)).toEqual([]);
  });

  it("神圣罗马帝国只把永久帝国议会时期标作雷根斯堡政治中心", () => {
    expect(activePlaces("polity-holy-roman-empire", 1024)).toEqual(["Aachen"]);
    expect(activePlaces("polity-holy-roman-empire", 1025)).toEqual([]);
    expect(activePlaces("polity-holy-roman-empire", 1662)).toEqual([]);
    expect(activePlaces("polity-holy-roman-empire", 1663)).toEqual(["Regensburg"]);
    expect(activePlaces("polity-holy-roman-empire", 1806)).toEqual(["Regensburg"]);
    expect(activePlaces("polity-holy-roman-empire", 1807)).toEqual([]);
    expect(
      data.geographicSnapshots.find(({ id }) => id === "geo-hre-regensburg-diet")
    ).toMatchObject({ role: "political-center", positionPrecision: "regional" });
  });

  it.each([
    ["polity-cn-former-yan", 34, 0],
    ["polity-cn-southern-ming", 15, 4],
    ["polity-cn-western-qin", 39, 0],
    ["polity-holy-roman-empire", 207, 638]
  ])("%s 的新覆盖与保留缺口一致", (id, coveredYears, unknownYears) => {
    expect(
      report.temporalCoverage.polities.find(({ entityId }) => entityId === id)?.geography
    ).toMatchObject({ coveredYears, unknownYears });
  });

  it("本批新增记录均有可定位历史证据、坐标证据和限制说明", () => {
    const ids = [
      "geo-former-yan-jicheng",
      "geo-former-yan-yecheng",
      "geo-southern-ming-guilin",
      "geo-southern-ming-nanning",
      "geo-southern-ming-anlong",
      "geo-southern-ming-kunming",
      "geo-western-qin-yongshi",
      "geo-western-qin-yuanchuan",
      "geo-western-qin-dujianshan",
      "geo-western-qin-tanjiao",
      "geo-western-qin-fuhan",
      "geo-western-qin-nanan",
      "geo-hre-regensburg-diet"
    ];

    for (const id of ids) {
      const snapshot = data.geographicSnapshots.find((record) => record.id === id)!;
      expect(snapshot.sourceRefs.every(({ locator }) => Boolean(locator?.trim()))).toBe(true);
      expect(snapshot.positionNote).toMatch(/不表示|不把|不是/);
      const sources = snapshot.sourceRefs.map(({ sourceId }) =>
        data.sources.find(({ id: candidateId }) => candidateId === sourceId)!
      );
      expect(sources.some(({ sourceType }) => sourceType === "dataset")).toBe(true);
      expect(
        sources.some(({ sourceType }) =>
          ["primary", "institutional", "secondary"].includes(sourceType)
        )
      ).toBe(true);
      expect(sources.every(({ url }) => Boolean(url))).toBe(true);
    }
  });
});
