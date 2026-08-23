import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  asCoverageReviewData,
  validateCoverageReviewData,
  type CoverageReviewData
} from "../src/data/coverageReview";
import type { CrownlineData } from "../src/domain/types";

export function coverageReviewPath(sourceRoot: string): string {
  return join(sourceRoot, "coverage", "coverage-review.json");
}

/** 读取并校验只供数据维护工具使用的覆盖审查目录。 */
export async function loadCoverageReviewData(
  sourceRoot = join(process.cwd(), "src", "data", "source"),
  data?: CrownlineData
): Promise<CoverageReviewData> {
  const path = coverageReviewPath(sourceRoot);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : String(error);
    if (code === "ENOENT") {
      throw new Error(`覆盖审查文件不存在：${path}`);
    }
    throw new Error(`无法读取覆盖审查文件 ${path}：${message}`);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`覆盖审查文件 JSON 格式错误 ${path}：${message}`);
  }

  const result = validateCoverageReviewData(input, data);
  if (!result.valid) {
    const details = result.issues
      .map((issue) => `[${issue.code}] ${issue.path} ${issue.message}`)
      .join("\n");
    throw new Error(`覆盖审查文件校验失败 ${path}：\n${details}`);
  }
  return asCoverageReviewData(input);
}
