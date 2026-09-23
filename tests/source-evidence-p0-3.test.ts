import { describe, expect, it } from "vitest";

import { loadCoverageReviewData } from "../scripts/coverage-review";
import { loadSourceData } from "../scripts/data-source";
import { buildDataCoverageReport } from "../src/data/coverageReport";

const data = await loadSourceData();
const report = buildDataCoverageReport(data, await loadCoverageReviewData(undefined, data));
const ids = [
  "geo-cheng-han-chengdu",
  "geo-eastern-zhou-luoyi",
  "geo-former-liang-guzang",
  "geo-former-shu-chengdu",
  "geo-later-han-kaifeng",
  "geo-later-jin-kaifeng",
  "geo-later-liang-kaifeng",
  "geo-later-liang-lu-guzang",
  "geo-later-shu-chengdu",
  "geo-later-tang-luoyang",
  "geo-later-zhou-kaifeng",
  "geo-wu-zhou-luoyang"
] as const;

describe("第三批来源定位 P0", () => {
  it("共享坐标来源的访问日期不早于各点位检索日期", () => {
    const source = data.sources.find(({ id }) => id === "source-p2-osm-nominatim");
    expect(source?.accessedAt).toBeDefined();
    for (const snapshot of data.geographicSnapshots) {
      for (const sourceRef of snapshot.sourceRefs) {
        if (sourceRef.sourceId !== source?.id) continue;
        const retrievedAt = sourceRef.locator?.match(/(\d{4}-\d{2}-\d{2})检索/)?.[1];
        if (retrievedAt) {
          expect(source.accessedAt! >= retrievedAt, snapshot.id).toBe(true);
        }
      }
    }
  });

  it.each(ids)("%s 使用具体坐标对象且全部引用已定位", (id) => {
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

  it("将部分定位点位预算由66收紧到54", () => {
    const quality = report.sourceReferenceQuality.geographicSnapshots;
    expect(quality.recordsWithoutLocatedSourceRefs).toBeLessThanOrEqual(59);
    expect(quality.recordsWithAllSourceRefsLocated).toBeGreaterThanOrEqual(81);
    expect(
      quality.recordsWithLocatedSourceRefs - quality.recordsWithAllSourceRefsLocated
    ).toBeLessThanOrEqual(54);
  });
});
