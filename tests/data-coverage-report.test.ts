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
        entities: 116,
        polities: 114,
        historicalPeriods: 2,
        persons: 1202,
        reigns: 1241,
        relationships: 18,
        events: 14,
        geographicSnapshots: 100,
        sources: 131
      },
      polityCoverage: {
        rulerDetails: { covered: 112, total: 114, percentage: 98.25 },
        localNames: { covered: 38, total: 114, percentage: 33.33 },
        geography: { covered: 69, total: 114, percentage: 60.53 }
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
      directPolityCount: 2,
      polityCountIncludingDescendants: 73
    });
    expect(centralAsia).toMatchObject({ directPolityCount: 2 });
    expect(southAsia).toMatchObject({ directPolityCount: 7 });
    expect(centralAsia?.coverage.localNames.covered).toBeGreaterThan(0);
    expect(southAsia?.coverage.localNames.covered).toBeGreaterThan(0);
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
