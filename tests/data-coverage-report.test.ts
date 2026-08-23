import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildDataCoverageReport, DATA_COVERAGE_REPORT_VERSION } from "../src/data/coverageReport";
import type { CrownlineData } from "../src/domain/types";

const data = await loadSourceData();

describe("数据覆盖报告", () => {
  it("汇总全局数据和扩容关键覆盖指标", () => {
    const report = buildDataCoverageReport(data);

    expect(report).toMatchObject({
      reportVersion: DATA_COVERAGE_REPORT_VERSION,
      dataSchemaVersion: 4,
      totals: {
        entities: 133,
        polities: 131,
        historicalPeriods: 2,
        persons: 1335,
        reigns: 1374,
        relationships: 18,
        events: 14,
        geographicSnapshots: 126,
        sources: 166
      },
      polityCoverage: {
        rulerDetails: { covered: 129, total: 131, percentage: 98.47 },
        localNames: { covered: 49, total: 131, percentage: 37.4 },
        geography: { covered: 86, total: 131, percentage: 65.65 }
      },
      polityGaps: {
        rulerDetails: ["polity-great-zimbabwe", "polity-teotihuacan-state"]
      }
    });
    expect(report.topLevelRegions).toHaveLength(11);
  });

  it("区分直接归属和子地区，并让跨地区政权进入双方统计", () => {
    const report = buildDataCoverageReport(data);
    const eastAsia = report.topLevelRegions.find(({ regionId }) => regionId === "region-east-asia");
    const centralAsia = report.topLevelRegions.find(
      ({ regionId }) => regionId === "region-central-asia"
    );
    const southAsia = report.topLevelRegions.find(
      ({ regionId }) => regionId === "region-south-asia"
    );

    expect(eastAsia).toMatchObject({
      directPolityCount: 6,
      polityCountIncludingDescendants: 77
    });
    expect(centralAsia).toMatchObject({
      directPolityCount: 5,
      coverage: {
        rulerDetails: { covered: 5, total: 5, percentage: 100 },
        localNames: { covered: 5, total: 5, percentage: 100 },
        geography: { covered: 5, total: 5, percentage: 100 }
      }
    });
    expect(southAsia).toMatchObject({ directPolityCount: 9 });
    expect(centralAsia?.coverage.localNames.covered).toBeGreaterThan(0);
    expect(southAsia?.coverage.localNames.covered).toBeGreaterThan(0);
  });

  it("反映东非与南部非洲扩展后的地区覆盖", () => {
    const report = buildDataCoverageReport(data);
    const eastAfrica = report.topLevelRegions.find(
      ({ regionId }) => regionId === "region-east-africa"
    );
    const southernAfrica = report.topLevelRegions.find(
      ({ regionId }) => regionId === "region-southern-africa"
    );

    expect(eastAfrica).toMatchObject({
      directPolityCount: 4,
      coverage: {
        rulerDetails: { covered: 4, total: 4, percentage: 100 },
        geography: { covered: 4, total: 4, percentage: 100 }
      }
    });
    expect(southernAfrica).toMatchObject({
      directPolityCount: 4,
      coverage: {
        rulerDetails: { covered: 3, total: 4, percentage: 75 },
        geography: { covered: 4, total: 4, percentage: 100 }
      }
    });
  });

  it("反映中国之外东亚扩展后的直接与子地区覆盖", () => {
    const report = buildDataCoverageReport(data);
    const eastAsia = report.topLevelRegions.find(({ regionId }) => regionId === "region-east-asia");

    expect(eastAsia).toMatchObject({
      directPolityCount: 6,
      polityCountIncludingDescendants: 77,
      coverage: {
        rulerDetails: { covered: 77, total: 77, percentage: 100 },
        localNames: { covered: 7, total: 77, percentage: 9.09 },
        geography: { covered: 32, total: 77, percentage: 41.56 }
      }
    });
  });

  it("反映南亚、美洲与北非时间纵深扩展", () => {
    const report = buildDataCoverageReport(data);
    const byId = new Map(report.topLevelRegions.map((region) => [region.regionId, region]));

    expect(byId.get("region-south-asia")).toMatchObject({
      directPolityCount: 9,
      coverage: {
        rulerDetails: { covered: 9, total: 9, percentage: 100 },
        geography: { covered: 9, total: 9, percentage: 100 }
      }
    });
    expect(byId.get("region-americas")).toMatchObject({
      directPolityCount: 7,
      coverage: {
        rulerDetails: { covered: 6, total: 7, percentage: 85.71 },
        geography: { covered: 7, total: 7, percentage: 100 }
      }
    });
    expect(byId.get("region-north-africa")).toMatchObject({
      directPolityCount: 6,
      coverage: {
        rulerDetails: { covered: 6, total: 6, percentage: 100 },
        geography: { covered: 6, total: 6, percentage: 100 }
      }
    });
  });

  it("空数据范围使用零百分比而不是无效数值", () => {
    const fixture: CrownlineData = {
      ...structuredClone(data),
      entities: [],
      persons: [],
      reigns: [],
      reignVacancies: [],
      relationships: [],
      events: [],
      geographicSnapshots: []
    };

    const report = buildDataCoverageReport(fixture);

    expect(report.polityCoverage.rulerDetails).toEqual({ covered: 0, total: 0, percentage: 0 });
    expect(
      report.topLevelRegions.every(({ coverage }) => coverage.geography.percentage === 0)
    ).toBe(true);
  });
});
