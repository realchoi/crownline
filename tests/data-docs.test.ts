import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import {
  buildCurrentDataStats,
  checkDataDocument,
  checkDataDocs,
  renderCurrentDataStatsBlock
} from "../scripts/check-data-docs";

const data = await loadSourceData();

describe("当前数据文档摘要", () => {
  it("README、数据契约和路线图当前摘要与真实数据一致", async () => {
    expect(await checkDataDocs(process.cwd(), data)).toEqual([]);
    expect(buildCurrentDataStats(data)).toMatchObject({
      entities: 133,
      polities: 131,
      historicalPeriods: 2,
      persons: 1335,
      reigns: 1374,
      geographicSnapshots: 146,
      sources: 186
    });
  });

  it.each([
    ["entities", "133 个实体", "999 个实体"],
    ["persons", "1335 位人物", "999 位人物"],
    ["geographicSnapshots", "146 条地理快照", "999 条地理快照"],
    ["sources", "186 项来源", "999 项来源"]
  ])("摘要中的%s错误时失败并指出文件和字段", (field, expected, actual) => {
    const contents = renderCurrentDataStatsBlock(data).replace(expected, actual);
    const issues = checkDataDocument("README.md", contents, data);
    const issue = issues[0];
    if (!issue) throw new Error("应返回文档摘要错误");

    expect(issue).toContain("README.md");
    expect(issue).toContain(field);
  });

  it("只检查当前摘要区块，历史进展中的旧数字不会触发失败", () => {
    const contents = [
      "完成记录（历史）：当时数据集只有 43 个世界样本、675 位人物。",
      renderCurrentDataStatsBlock(data)
    ].join("\n\n");

    expect(checkDataDocument("ROADMAP.md", contents, data)).toEqual([]);
  });

  it("缺少完整标记区块时失败", () => {
    expect(checkDataDocument("docs/data-contract.md", "当前数据快照：133 个实体。", data)).toEqual([
      expect.stringContaining("docs/data-contract.md")
    ]);
  });
});
