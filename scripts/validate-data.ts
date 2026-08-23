import { loadCoverageReviewData } from "./coverage-review";
import { loadSourceData } from "./data-source";
import { validateCrownlineData } from "../src/domain/dataValidation";

// 独立命令行入口聚合源分片并执行权威的完整数据校验。
try {
  const data = await loadSourceData();
  const result = validateCrownlineData(data);
  if (!result.valid) {
    const details = result.issues
      .map((issue) => `[${issue.code}] ${issue.path} ${issue.message}`)
      .join("\n");
    throw new Error(`历史数据校验失败：\n${details}`);
  }
  await loadCoverageReviewData(undefined, data);
  console.log(
    `数据校验通过：${data.timelineSections.length} 个阶段，${data.entities.length} 个实体，` +
      `${data.persons.length} 个人物，${data.reigns.length} 条任期，` +
      `${data.geographicSnapshots.length} 条地理快照，${data.boundarySnapshots.length} 条疆域快照，` +
      `${data.sources.length} 个来源`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
