import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { loadCoverageReviewData } from "../scripts/coverage-review";
import { loadSourceData } from "../scripts/data-source";
import { checkGlobalCoveragePlan } from "../scripts/check-global-coverage-plan";
import { buildDataCoverageReport } from "../src/data/coverageReport";

const data = await loadSourceData();
const review = await loadCoverageReviewData();
const report = buildDataCoverageReport(data, review);

describe("全球覆盖规划", () => {
  it("提交的矩阵与当前源数据一致", async () => {
    const contents = await readFile("docs/global-coverage-plan.md", "utf8");
    expect(checkGlobalCoveragePlan(contents, report)).toEqual([]);
  });

  it("矩阵数字漂移时失败", async () => {
    const contents = await readFile("docs/global-coverage-plan.md", "utf8");
    const broken = contents.replace("| 西亚 | 0 | 0 |", "| 西亚 | 9 | 0 |");
    expect(checkGlobalCoveragePlan(broken, report)).toEqual(["全球覆盖规划矩阵与当前源数据不一致"]);
  });
});
