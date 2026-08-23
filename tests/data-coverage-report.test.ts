import { describe, expect, it } from "vitest";

import { loadCoverageReviewData } from "../scripts/coverage-review";
import { loadSourceData } from "../scripts/data-source";
import {
  buildDataCoverageReport,
  DATA_COVERAGE_REPORT_VERSION,
  type DataCoverageReport
} from "../src/data/coverageReport";
import { CONFIDENCE_LEVELS, RELATIONSHIP_TYPES, SOURCE_TYPES } from "../src/domain/types";
import type { CoverageReviewData } from "../src/data/coverageReview";
import type { CrownlineData } from "../src/domain/types";

const data = await loadSourceData();
const coverageReview = await loadCoverageReviewData();

function polityIdsWithout(dimension: "localNames" | "geography" | "rulerDetails"): string[] {
  const personIds = new Set(data.persons.map(({ id }) => id));
  return data.entities
    .filter(({ entityKind }) => entityKind === "polity")
    .filter((polity) => {
      if (dimension === "localNames") {
        return polity.names.local === undefined || polity.names.localLanguageTag === undefined;
      }
      if (dimension === "geography") {
        return !data.geographicSnapshots.some(({ polityId }) => polityId === polity.id);
      }
      const reigns = data.reigns.filter(({ polityId }) => polityId === polity.id);
      return reigns.length === 0 || !reigns.every(({ personId }) => personIds.has(personId));
    })
    .map(({ id }) => id);
}

function reviewEntry(
  entityId: string,
  dimension: "rulerDetails" | "localNames" | "geography",
  status: "reviewed-unavailable" | "not-applicable" | "pending-review"
) {
  return { entityId, dimension, status, note: `测试审查：${status}` } as const;
}

function sourceQualityFixture(): CrownlineData {
  const fixture = structuredClone(data);
  fixture.sources = [
    {
      id: "source-quality-primary",
      title: "有 URL 与访问日期",
      sourceType: "primary",
      citation: "测试来源",
      url: "https://example.test/primary",
      accessedAt: "2026-08-23"
    },
    {
      id: "source-quality-secondary",
      title: "无 URL",
      sourceType: "secondary",
      citation: "测试来源"
    },
    {
      id: "source-quality-tertiary",
      title: "空白元数据不计入",
      sourceType: "tertiary",
      citation: "测试来源",
      url: "   ",
      accessedAt: "  "
    }
  ];
  fixture.relationships = fixture.relationships.slice(0, 3).map((relationship, index) => ({
    ...relationship,
    sourceRefs:
      index === 0
        ? []
        : index === 1
          ? [{ sourceId: "source-quality-secondary", locator: "  " }]
          : [{ sourceId: "source-quality-primary", locator: "p. 12" }]
  }));
  fixture.events = fixture.events.slice(0, 2).map((event, index) => ({
    ...event,
    sourceRefs: index === 0 ? [] : [{ sourceId: "source-quality-primary", locator: "§ 3" }]
  }));
  fixture.geographicSnapshots = fixture.geographicSnapshots.slice(0, 2).map((snapshot) => ({
    ...snapshot,
    sourceRefs: [{ sourceId: "source-quality-primary", locator: "  " }]
  }));
  return fixture;
}

describe("数据覆盖报告 v2", () => {
  it("固定真实数据摘要并区分已用数据、已审查不可用和尚未审查", () => {
    const report = buildDataCoverageReport(data, coverageReview);

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
        rulerDetails: {
          total: 131,
          available: 129,
          reviewedUnavailable: 2,
          notApplicable: 0,
          pendingReview: 0,
          applicableTotal: 131,
          availablePercentage: 98.47,
          reviewedPercentage: 100
        },
        localNames: {
          total: 131,
          available: 49,
          reviewedUnavailable: 0,
          notApplicable: 0,
          pendingReview: 82,
          applicableTotal: 131,
          availablePercentage: 37.4,
          reviewedPercentage: 37.4
        },
        geography: {
          total: 131,
          available: 86,
          reviewedUnavailable: 0,
          notApplicable: 0,
          pendingReview: 45,
          applicableTotal: 131,
          availablePercentage: 65.65,
          reviewedPercentage: 65.65
        }
      }
    });
    expect(report.reviewableGaps.rulerDetails.reviewedUnavailable).toEqual([
      "polity-great-zimbabwe",
      "polity-teotihuacan-state"
    ]);
    expect(report.reviewableGaps.localNames.pendingReview).toHaveLength(82);
    expect(report.reviewableGaps.geography.pendingReview).toHaveLength(45);
    expect(report.reviewableGaps.localNames.pendingReview).toEqual(
      [...report.reviewableGaps.localNames.pendingReview].sort((left, right) =>
        left.localeCompare(right, "en")
      )
    );
    expect(report.sourceQuality).toEqual({
      total: 166,
      byType: { primary: 2, secondary: 20, tertiary: 66, dataset: 2, institutional: 76 },
      withUrl: 165,
      withoutUrl: 1,
      withAccessedAt: 165,
      withoutAccessedAt: 1
    });
    expect(report.sourceReferenceQuality).toEqual({
      relationships: {
        records: 18,
        recordsWithSourceRefs: 18,
        recordsWithLocatedSourceRefs: 18,
        recordsWithoutLocatedSourceRefs: 0
      },
      events: {
        records: 14,
        recordsWithSourceRefs: 14,
        recordsWithLocatedSourceRefs: 14,
        recordsWithoutLocatedSourceRefs: 0
      },
      geographicSnapshots: {
        records: 126,
        recordsWithSourceRefs: 126,
        recordsWithLocatedSourceRefs: 26,
        recordsWithoutLocatedSourceRefs: 100
      }
    });
  });

  it("四种状态使用明确分母，且不适用不进入适用分母", () => {
    const missingLocal = polityIdsWithout("localNames");
    const review: CoverageReviewData = {
      entries: [
        reviewEntry(missingLocal[0]!, "localNames", "reviewed-unavailable"),
        reviewEntry(missingLocal[1]!, "localNames", "not-applicable"),
        reviewEntry(missingLocal[2]!, "localNames", "pending-review")
      ]
    };
    const report = buildDataCoverageReport(data, review);
    const metric = report.polityCoverage.localNames;

    expect(metric).toMatchObject({
      total: 131,
      available: 49,
      reviewedUnavailable: 1,
      notApplicable: 1,
      pendingReview: 80,
      applicableTotal: 130,
      reviewedPercentage: 38.93
    });
    expect(metric.availablePercentage).toBe(37.69);
    expect(report.reviewableGaps.localNames.notApplicable).toEqual([missingLocal[1]]);
    expect(report.reviewableGaps.localNames.reviewedUnavailable).toEqual([missingLocal[0]]);
  });

  it("已有业务数据自动为 available，并拒绝人工状态冲突", () => {
    const availablePolity = data.entities.find(
      ({ entityKind, names }) =>
        entityKind === "polity" && names.local !== undefined && names.localLanguageTag !== undefined
    );
    if (!availablePolity) throw new Error("缺少测试政权");

    expect(() =>
      buildDataCoverageReport(data, {
        entries: [reviewEntry(availablePolity.id, "localNames", "pending-review")]
      })
    ).toThrow(`${availablePolity.id}`);
  });

  it("拒绝悬空实体、历史分期和重复审查记录", () => {
    expect(() =>
      buildDataCoverageReport(data, {
        entries: [reviewEntry("polity-missing", "localNames", "pending-review")]
      })
    ).toThrow("polity-missing");

    const historicalPeriod = data.entities.find(
      ({ entityKind }) => entityKind === "historical-period"
    );
    if (!historicalPeriod) throw new Error("缺少测试历史分期");
    expect(() =>
      buildDataCoverageReport(data, {
        entries: [reviewEntry(historicalPeriod.id, "localNames", "pending-review")]
      })
    ).toThrow("COVERAGE_REVIEW_HISTORICAL_PERIOD");

    const missing = polityIdsWithout("geography")[0];
    if (!missing) throw new Error("缺少无地图政权");
    const duplicate = reviewEntry(missing, "geography", "pending-review");
    expect(() => buildDataCoverageReport(data, { entries: [duplicate, duplicate] })).toThrow(
      "COVERAGE_REVIEW_DUPLICATE"
    );
  });

  it("保留顶层地区直接/子地区统计并正确处理跨地区政权", () => {
    const report = buildDataCoverageReport(data, coverageReview);
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
        rulerDetails: { available: 5, total: 5, availablePercentage: 100 },
        localNames: { available: 5, total: 5, availablePercentage: 100 },
        geography: { available: 5, total: 5, availablePercentage: 100 }
      }
    });
    expect(southAsia?.coverage.localNames.available).toBeGreaterThan(0);
    if (!eastAsia) throw new Error("缺少东亚地区报告");
    expect(eastAsia.polityCountIncludingDescendants).toBeGreaterThan(eastAsia.directPolityCount);
  });

  it("报告 JSON 序列化确定，且不依赖审查、关系或来源数组输入顺序", () => {
    const reversedReview: CoverageReviewData = {
      entries: [...coverageReview.entries].reverse()
    };
    const reordered = structuredClone(data);
    reordered.relationships.reverse();
    reordered.sources.reverse();
    const first = buildDataCoverageReport(data, coverageReview);
    const second = buildDataCoverageReport(reordered, reversedReview);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("关系分布和来源质量", () => {
  it("关系摘要覆盖全部枚举、去重参与政权并列出地区分布", () => {
    const report = buildDataCoverageReport(data, coverageReview);
    const summary = report.relationshipSummary;

    expect(Object.keys(summary.byType)).toEqual([...RELATIONSHIP_TYPES]);
    expect(Object.keys(summary.byConfidence)).toEqual([...CONFIDENCE_LEVELS]);
    expect(summary.records).toBe(18);
    expect(summary.participantPolities).toBeLessThanOrEqual(summary.totalPolities);
    expect(summary.regionsWithRecords.length + summary.regionsWithoutRecords.length).toBe(11);
    expect(summary.regionsWithRecords).not.toEqual([]);
    expect(summary.regionsWithRecords).toEqual(
      expect.arrayContaining(["region-east-asia", "region-west-asia", "region-north-africa"])
    );
    expect(report).not.toHaveProperty("polityGaps.relationships");
  });

  it("重复参与同一关系的政权只计一次", () => {
    const firstRelationship = data.relationships[0];
    if (!firstRelationship) throw new Error("缺少关系测试记录");
    const fixture = structuredClone(data);
    fixture.relationships = [firstRelationship, firstRelationship];
    const report = buildDataCoverageReport(fixture, { entries: [] });

    expect(report.relationshipSummary.records).toBe(2);
    expect(report.relationshipSummary.participantPolities).toBe(
      new Set(firstRelationship.participants.map(({ entityId }) => entityId)).size
    );
  });

  it("没有关系记录时只生成分布零值，不生成关系缺口列表", () => {
    const fixture = structuredClone(data);
    fixture.relationships = [];
    const report = buildDataCoverageReport(fixture, { entries: coverageReview.entries });

    expect(Object.values(report.relationshipSummary.byType)).toEqual(
      RELATIONSHIP_TYPES.map(() => 0)
    );
    expect(report.relationshipSummary.participantPolities).toBe(0);
    expect(report.relationshipSummary.regionsWithoutRecords).toHaveLength(11);
    expect(report).not.toHaveProperty("polityGaps.relationships");
  });

  it("来源类型、URL、访问日期和三类关键记录定位引用统计正确", () => {
    const report = buildDataCoverageReport(sourceQualityFixture(), { entries: [] });

    expect(Object.keys(report.sourceQuality.byType)).toEqual([...SOURCE_TYPES]);
    expect(report.sourceQuality).toMatchObject({
      total: 3,
      byType: { primary: 1, secondary: 1, tertiary: 1, dataset: 0, institutional: 0 },
      withUrl: 1,
      withoutUrl: 2,
      withAccessedAt: 1,
      withoutAccessedAt: 2
    });
    expect(report.sourceReferenceQuality).toEqual({
      relationships: {
        records: 3,
        recordsWithSourceRefs: 2,
        recordsWithLocatedSourceRefs: 1,
        recordsWithoutLocatedSourceRefs: 2
      },
      events: {
        records: 2,
        recordsWithSourceRefs: 1,
        recordsWithLocatedSourceRefs: 1,
        recordsWithoutLocatedSourceRefs: 1
      },
      geographicSnapshots: {
        records: 2,
        recordsWithSourceRefs: 2,
        recordsWithLocatedSourceRefs: 0,
        recordsWithoutLocatedSourceRefs: 2
      }
    });
  });
});

describe("空范围", () => {
  it("使用零百分比而不是无效数值", () => {
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
    const report: DataCoverageReport = buildDataCoverageReport(fixture, { entries: [] });

    expect(report.polityCoverage.rulerDetails).toEqual({
      total: 0,
      available: 0,
      reviewedUnavailable: 0,
      notApplicable: 0,
      pendingReview: 0,
      applicableTotal: 0,
      availablePercentage: 0,
      reviewedPercentage: 0
    });
    expect(report.relationshipSummary.participantPercentage).toBe(0);
    expect(
      report.topLevelRegions.every(({ coverage }) => coverage.geography.availablePercentage === 0)
    ).toBe(true);
  });
});
