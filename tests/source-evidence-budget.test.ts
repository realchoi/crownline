import { describe, expect, it } from "vitest";

import { loadCoverageReviewData } from "../scripts/coverage-review";
import { loadSourceData } from "../scripts/data-source";
import { checkSourceEvidenceBudget } from "../scripts/check-source-evidence";
import { buildDataCoverageReport } from "../src/data/coverageReport";

const data = await loadSourceData();
const coverageReview = await loadCoverageReviewData();

describe("来源证据非回归预算", () => {
  it("当前来源定位缺口不超过已登记预算", () => {
    const report = buildDataCoverageReport(data, coverageReview);

    expect(checkSourceEvidenceBudget(report)).toEqual([]);
  });

  it("证据改善后要求同步收紧预算", () => {
    const report = buildDataCoverageReport(data, coverageReview);
    report.sourceReferenceQuality.persons.recordsWithoutLocatedSourceRefs = 1196;
    expect(checkSourceEvidenceBudget(report)[0]).toContain("已由 1197 降至 1196");
  });

  it("新增无定位人物记录时拒绝通过", () => {
    const fixture = structuredClone(data);
    fixture.persons.push({
      id: "person-source-evidence-regression",
      names: { primary: "测试人物", aliases: [] },
      description: "仅用于验证来源证据预算。",
      sourceRefs: [{ sourceId: fixture.sources[0]!.id }]
    });
    const report = buildDataCoverageReport(fixture, coverageReview);

    expect(checkSourceEvidenceBudget(report)).toEqual([
      expect.stringContaining("persons 无定位记录由 1197 增至 1198")
    ]);
  });
});
