import { describe, expect, it } from "vitest";

import { loadCoverageReviewData } from "../scripts/coverage-review";
import { loadSourceData } from "../scripts/data-source";
import { buildDataCoverageReport } from "../src/data/coverageReport";

const data = await loadSourceData();
const coverageReview = await loadCoverageReviewData(undefined, data);
const report = buildDataCoverageReport(data, coverageReview);

const newlyVerifiedIds = [
  "geo-abbasid-baghdad",
  "geo-byzantine-nicaea",
  "geo-delhi-sultanate-delhi",
  "geo-ethiopian-gondar",
  "geo-ottoman-edirne",
  "geo-safavid-qazvin",
  "geo-safavid-tabriz",
  "geo-umayyad-harran"
] as const;

const partialClosureIds = [
  "geo-chen-jiankang",
  "geo-liang-jiankang",
  "geo-liu-song-jiankang",
  "geo-southern-qi-jiankang"
] as const;

describe("第二批来源定位 P0", () => {
  it.each([...newlyVerifiedIds, ...partialClosureIds])("%s 的全部引用均已定位", (id) => {
    const snapshot = data.geographicSnapshots.find(({ id: candidateId }) => candidateId === id);
    expect(snapshot, id).toBeDefined();
    expect(
      snapshot!.sourceRefs.every(({ locator }) => Boolean(locator?.trim())),
      id
    ).toBe(true);
    expect(
      snapshot!.sourceRefs.some(({ sourceId }) => sourceId === "source-geonames"),
      id
    ).toBe(false);
  });

  it("保留巴格达的萨迈拉中断，不把哈里发国存续期当成都城时期", () => {
    expect(
      data.geographicSnapshots.find(({ id }) => id === "geo-abbasid-baghdad")?.periods
    ).toEqual([
      { start: { year: 762, precision: "exact" }, end: { year: 835, precision: "exact" } },
      { start: { year: 893, precision: "exact" }, end: { year: 1258, precision: "exact" } }
    ]);
  });

  it("按直接证据修正贡德尔、尼西亚和德里语义", () => {
    expect(
      data.geographicSnapshots.find(({ id }) => id === "geo-ethiopian-gondar")?.periods
    ).toEqual([
      { start: { year: 1636, precision: "exact" }, end: { year: 1769, precision: "circa" } }
    ]);
    expect(
      data.geographicSnapshots.find(({ id }) => id === "geo-byzantine-nicaea")?.periods
    ).toEqual([
      { start: { year: 1204, precision: "exact" }, end: { year: 1261, precision: "exact" } }
    ]);
    expect(
      data.geographicSnapshots.find(({ id }) => id === "geo-delhi-sultanate-delhi")?.role
    ).toBe("representative-center");
  });

  it("继续收紧无定位和部分定位点位预算", () => {
    const quality = report.sourceReferenceQuality.geographicSnapshots;
    expect(quality.recordsWithoutLocatedSourceRefs).toBeLessThanOrEqual(59);
    expect(
      quality.recordsWithLocatedSourceRefs - quality.recordsWithAllSourceRefsLocated
    ).toBeLessThanOrEqual(66);
  });
});
