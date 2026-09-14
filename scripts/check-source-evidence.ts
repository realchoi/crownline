import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildDataCoverageReport, type DataCoverageReport } from "../src/data/coverageReport";
import { loadCoverageReviewData } from "./coverage-review";
import { loadSourceData } from "./data-source";

export const SOURCE_EVIDENCE_BUDGET = {
  entities: 114,
  persons: 1197,
  reigns: 1236,
  reignVacancies: 11,
  regions: 12,
  relationships: 0,
  events: 0,
  geographicSnapshots: 75,
  boundarySnapshots: 0
} as const;

type EvidenceDimension = keyof typeof SOURCE_EVIDENCE_BUDGET;

/** 预算必须随证据改善同步收紧，从而永久阻止无定位引用回退。 */
export function checkSourceEvidenceBudget(report: DataCoverageReport): string[] {
  return (Object.keys(SOURCE_EVIDENCE_BUDGET) as EvidenceDimension[]).flatMap((dimension) => {
    const budget = SOURCE_EVIDENCE_BUDGET[dimension];
    const actual = report.sourceReferenceQuality[dimension].recordsWithoutLocatedSourceRefs;
    if (actual > budget) {
      return [`${dimension} 无定位记录由 ${budget} 增至 ${actual}；请补充可核查 locator`];
    }
    return actual < budget
      ? [`${dimension} 无定位记录已由 ${budget} 降至 ${actual}；请同步收紧证据预算`]
      : [];
  });
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  const data = await loadSourceData();
  const coverageReview = await loadCoverageReviewData(undefined, data);
  const issues = checkSourceEvidenceBudget(buildDataCoverageReport(data, coverageReview));
  if (issues.length > 0) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("来源证据预算通过：所有记录类型的无定位引用均未增加。");
  }
}
