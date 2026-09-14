import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildDataCoverageReport, type DataCoverageReport } from "../src/data/coverageReport";
import { loadCoverageReviewData } from "./coverage-review";
import { loadSourceData } from "./data-source";

export const GLOBAL_COVERAGE_START = "<!-- crownline-global-coverage:start -->";
export const GLOBAL_COVERAGE_END = "<!-- crownline-global-coverage:end -->";

export function renderGlobalCoverageTable(report: DataCoverageReport): string {
  const { eras, regions } = report.globalCoverageMatrix;
  const header = `| 地区 | ${eras.map(({ label }) => label).join(" | ")} |`;
  const separator = `| --- | ${eras.map(() => "---:").join(" | ")} |`;
  const rows = regions.map(({ name, cells }) => {
    return `| ${name} | ${cells.map(({ polityCount }) => polityCount).join(" | ")} |`;
  });
  return [GLOBAL_COVERAGE_START, "", header, separator, ...rows, "", GLOBAL_COVERAGE_END].join(
    "\n"
  );
}

export function checkGlobalCoveragePlan(contents: string, report: DataCoverageReport): string[] {
  const start = contents.indexOf(GLOBAL_COVERAGE_START);
  const end = contents.indexOf(GLOBAL_COVERAGE_END);
  if (start < 0 || end < start) return ["全球覆盖规划缺少完整矩阵标记区块"];
  const actual = contents.slice(start, end + GLOBAL_COVERAGE_END.length);
  return actual === renderGlobalCoverageTable(report) ? [] : ["全球覆盖规划矩阵与当前源数据不一致"];
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  const data = await loadSourceData();
  const review = await loadCoverageReviewData(undefined, data);
  const report = buildDataCoverageReport(data, review);
  const path = join(process.cwd(), "docs", "global-coverage-plan.md");
  const issues = checkGlobalCoveragePlan(await readFile(path, "utf8"), report);
  if (issues.length > 0) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("全球覆盖规划矩阵与当前数据一致。");
  }
}
