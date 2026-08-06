import { describe, expect, it } from "vitest";

import { validateCrownlineData } from "../src/domain/dataValidation";
import type { CrownlineData, HistoricalEntity } from "../src/domain/types";

function makeEntity(overrides: Partial<HistoricalEntity> = {}): HistoricalEntity {
  return {
    id: "polity-cn-test",
    entityKind: "polity",
    polityForms: ["dynasty"],
    displayCategory: "mainline",
    names: { primary: "测试政权", aliases: ["测试"] },
    existencePeriods: [
      {
        start: { year: 1, precision: "exact" },
        end: { year: 10, precision: "exact" }
      }
    ],
    chronologyStatus: "accepted",
    historicalRegionIds: ["region-east-asia"],
    culturalSphereIds: [],
    modernAreaIds: [],
    description: "用于验证契约的完整测试政权。",
    sourceRefs: [{ sourceId: "source-test" }],
    confidence: "high",
    ...overrides
  };
}

function makeValidData(): CrownlineData {
  return {
    schemaVersion: 2,
    chronologyPolicy: {
      calendar: "historical-year",
      hasYearZero: false,
      intervalBoundary: "inclusive",
      yearSelection: "exists-at-any-time-during-year"
    },
    timelineSections: [
      {
        id: "section-test",
        title: "测试阶段",
        displayRange: "1—10",
        range: { startYear: 1, endYear: 10 },
        entityIds: ["polity-cn-test"]
      }
    ],
    entities: [makeEntity()],
    regions: [
      {
        id: "region-east-asia",
        names: { primary: "东亚", aliases: ["Eastern Asia"] },
        regionKind: "historical-region",
        coverage: { status: "partial", note: "当前主要收录中国历史条目。" },
        description: "用于测试的宽粒度历史地区。",
        sourceRefs: [{ sourceId: "source-test" }]
      }
    ],
    persons: [],
    reigns: [],
    relationships: [],
    events: [],
    sources: [
      {
        id: "source-test",
        title: "测试来源",
        sourceType: "dataset",
        citation: "仅供自动化测试使用。"
      }
    ]
  };
}

function issueCodes(input: unknown): string[] {
  return validateCrownlineData(input).issues.map((issue) => issue.code);
}

describe("JSON Schema 结构校验", () => {
  it("接受带层级、名称与覆盖说明的地区契约 v2", () => {
    const data = makeValidData() as unknown as {
      schemaVersion: number;
      regions: Array<Record<string, unknown>>;
    };
    data.schemaVersion = 2;
    data.regions[0] = {
      id: "region-east-asia",
      names: { primary: "东亚", aliases: ["Eastern Asia"] },
      regionKind: "historical-region",
      coverage: {
        status: "partial",
        note: "当前主要收录中国历史条目。"
      },
      description: "用于测试的宽粒度历史地区。",
      sourceRefs: [{ sourceId: "source-test" }]
    };

    expect(validateCrownlineData(data)).toEqual({ valid: true, issues: [] });
  });

  it("接受完整的最小数据集", () => {
    expect(validateCrownlineData(makeValidData())).toEqual({ valid: true, issues: [] });
  });

  it("拒绝缺失必填字段、未知枚举和公元 0 年", () => {
    const missingVersion = { ...makeValidData() } as Partial<CrownlineData>;
    delete missingVersion.schemaVersion;
    expect(issueCodes(missingVersion)).toContain("SCHEMA_ERROR");

    const unknownCategory = makeValidData() as unknown as {
      entities: Array<{ displayCategory: string }>;
    };
    unknownCategory.entities[0]!.displayCategory = "featured";
    expect(issueCodes(unknownCategory)).toContain("SCHEMA_ERROR");

    const yearZero = makeValidData();
    yearZero.entities[0]!.existencePeriods[0]!.start.year = 0;
    expect(issueCodes(yearZero)).toContain("SCHEMA_ERROR");
  });
});

describe("跨记录语义校验", () => {
  it("发现全局重复 ID", () => {
    const data = makeValidData();
    data.regions[0]!.id = data.entities[0]!.id;
    expect(issueCodes(data)).toContain("DUPLICATE_ID");
  });

  it("发现倒置、重叠和可合并的相邻区间", () => {
    const reversed = makeValidData();
    reversed.entities[0]!.existencePeriods[0] = {
      start: { year: 10, precision: "exact" },
      end: { year: 1, precision: "exact" }
    };
    expect(issueCodes(reversed)).toContain("INVALID_INTERVAL");

    const overlapping = makeValidData();
    overlapping.entities[0]!.existencePeriods.push({
      start: { year: 10, precision: "exact" },
      end: { year: 20, precision: "exact" }
    });
    expect(issueCodes(overlapping)).toContain("OVERLAPPING_INTERVALS");

    const adjacent = makeValidData();
    adjacent.entities[0]!.existencePeriods.push({
      start: { year: 11, precision: "exact" },
      end: { year: 20, precision: "exact" }
    });
    expect(issueCodes(adjacent)).toContain("ADJACENT_INTERVALS");
  });

  it("发现时间轴、地区和来源的悬空引用", () => {
    const sectionRef = makeValidData();
    sectionRef.timelineSections[0]!.entityIds = ["polity-missing"];
    expect(issueCodes(sectionRef)).toContain("DANGLING_ENTITY_REF");

    const regionRef = makeValidData();
    regionRef.entities[0]!.historicalRegionIds = ["region-missing"];
    expect(issueCodes(regionRef)).toContain("DANGLING_REGION_REF");

    const sourceRef = makeValidData();
    sourceRef.entities[0]!.sourceRefs = [{ sourceId: "source-missing" }];
    expect(issueCodes(sourceRef)).toContain("DANGLING_SOURCE_REF");
  });

  it("拒绝悬空、跨类型和循环的地区父子关系", () => {
    const danglingParent = makeValidData();
    danglingParent.regions[0]!.parentRegionId = "region-missing";
    expect(issueCodes(danglingParent)).toContain("DANGLING_REGION_PARENT_REF");

    const mixedKinds = makeValidData();
    mixedKinds.regions.push({
      id: "region-modern-test",
      names: { primary: "现代测试范围", aliases: [] },
      regionKind: "modern-area",
      parentRegionId: "region-east-asia",
      coverage: { status: "none", note: "尚未收录。" },
      description: "用于验证地区类型边界。",
      sourceRefs: [{ sourceId: "source-test" }]
    });
    expect(issueCodes(mixedKinds)).toContain("INVALID_REGION_PARENT_KIND");

    const cycle = makeValidData();
    cycle.regions.push({
      id: "region-china",
      names: { primary: "中国历史范围", aliases: [] },
      regionKind: "historical-region",
      parentRegionId: "region-east-asia",
      coverage: { status: "partial", note: "当前收录有限。" },
      description: "用于验证地区循环。",
      sourceRefs: [{ sourceId: "source-test" }]
    });
    cycle.regions[0]!.parentRegionId = "region-china";
    expect(issueCodes(cycle)).toContain("CYCLIC_REGION_PARENT");
  });

  it("拒绝实体把现代范围当作历史地区引用", () => {
    const data = makeValidData();
    data.regions.push({
      id: "region-modern-test",
      names: { primary: "现代测试范围", aliases: [] },
      regionKind: "modern-area",
      coverage: { status: "none", note: "尚未收录。" },
      description: "用于验证三类地区职责不可混用。",
      sourceRefs: [{ sourceId: "source-test" }]
    });
    data.entities[0]!.historicalRegionIds = ["region-modern-test"];

    expect(issueCodes(data)).toContain("INVALID_REGION_REFERENCE_KIND");
  });

  it("要求每个实体至少绑定一个历史地区", () => {
    const data = makeValidData();
    data.entities[0]!.historicalRegionIds = [];

    expect(issueCodes(data)).toContain("SCHEMA_ERROR");
  });

  it("拒绝历史分期的政权形态和缺少说明的争议口径", () => {
    const period = makeValidData();
    period.entities[0]!.entityKind = "historical-period";
    expect(issueCodes(period)).toContain("INVALID_ENTITY_CLASSIFICATION");

    const disputed = makeValidData();
    disputed.entities[0]!.chronologyStatus = "disputed";
    expect(issueCodes(disputed)).toContain("MISSING_CHRONOLOGY_NOTE");
  });

  it("拒绝关系中的重复参与方", () => {
    const data = makeValidData();
    data.relationships.push({
      id: "relation-test",
      type: "alliance",
      participants: [
        { entityId: "polity-cn-test", role: "party" },
        { entityId: "polity-cn-test", role: "party" }
      ],
      periods: [],
      summary: "测试关系。",
      eventIds: [],
      sourceRefs: [{ sourceId: "source-test" }],
      confidence: "high"
    });
    expect(issueCodes(data)).toContain("DUPLICATE_RELATIONSHIP_PARTICIPANT");
  });
});
