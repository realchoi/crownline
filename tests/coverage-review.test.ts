import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  COVERAGE_REVIEW_DIMENSIONS,
  COVERAGE_REVIEW_STATUSES,
  validateCoverageReviewData
} from "../src/data/coverageReview";
import { loadCoverageReviewData } from "../scripts/coverage-review";
import { loadSourceData } from "../scripts/data-source";

const data = await loadSourceData();
const temporaryRoots: string[] = [];

async function createReviewRoot(contents: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "crownline-coverage-review-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "coverage"), { recursive: true });
  await writeFile(join(root, "coverage", "coverage-review.json"), contents, "utf8");
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("覆盖审查目录加载与校验", () => {
  it("正常加载有效文件，并固定枚举集合", async () => {
    const review = await loadCoverageReviewData();

    expect(review.entries).toHaveLength(3);
    expect(review.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "polity-cn-xia",
          dimension: "geography",
          status: "reviewed-unavailable"
        })
      ])
    );
    expect(COVERAGE_REVIEW_DIMENSIONS).toEqual(["rulerDetails", "localNames", "geography"]);
    expect(COVERAGE_REVIEW_STATUSES).toEqual([
      "available",
      "reviewed-unavailable",
      "not-applicable",
      "pending-review"
    ]);
  });

  it("JSON 格式错误和缺失文件都包含清晰路径", async () => {
    const root = await createReviewRoot("{");
    await expect(loadCoverageReviewData(root)).rejects.toThrow(
      `${root}/coverage/coverage-review.json`
    );

    const missingRoot = await mkdtemp(join(tmpdir(), "crownline-coverage-review-missing-"));
    temporaryRoots.push(missingRoot);
    await expect(loadCoverageReviewData(missingRoot)).rejects.toThrow("覆盖审查文件不存在");
  });

  it("拒绝根结构、未知维度/状态、空 note 和重复记录", () => {
    expect(validateCoverageReviewData([]).valid).toBe(false);
    expect(
      validateCoverageReviewData({
        entries: [
          {
            entityId: "polity-cn-xia",
            dimension: "unknown",
            status: "pending-review",
            note: "说明"
          }
        ]
      }).issues.map(({ code }) => code)
    ).toContain("COVERAGE_REVIEW_DIMENSION");
    expect(
      validateCoverageReviewData({
        entries: [
          {
            entityId: "polity-cn-xia",
            dimension: "localNames",
            status: "unknown",
            note: "说明"
          }
        ]
      }).issues.map(({ code }) => code)
    ).toContain("COVERAGE_REVIEW_STATUS");
    expect(
      validateCoverageReviewData({
        entries: [
          {
            entityId: "polity-cn-xia",
            dimension: "localNames",
            status: "pending-review",
            note: "   "
          }
        ]
      }).issues.map(({ code }) => code)
    ).toContain("COVERAGE_REVIEW_NOTE");

    const duplicate = {
      entityId: "polity-great-zimbabwe",
      dimension: "rulerDetails",
      status: "reviewed-unavailable",
      note: "已审查，当前无法可靠补充。"
    };
    expect(validateCoverageReviewData({ entries: [duplicate, duplicate] }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "COVERAGE_REVIEW_DUPLICATE" })])
    );
  });

  it("拒绝悬空实体、历史分期和人工状态冲突", () => {
    expect(
      validateCoverageReviewData(
        {
          entries: [
            {
              entityId: "polity-missing",
              dimension: "localNames",
              status: "pending-review",
              note: "待审查。"
            }
          ]
        },
        data
      ).issues
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "COVERAGE_REVIEW_UNKNOWN_ENTITY" })])
    );

    const historicalPeriod = data.entities.find(
      ({ entityKind }) => entityKind === "historical-period"
    );
    if (!historicalPeriod) throw new Error("缺少测试历史分期");
    expect(
      validateCoverageReviewData(
        {
          entries: [
            {
              entityId: historicalPeriod.id,
              dimension: "localNames",
              status: "pending-review",
              note: "待审查。"
            }
          ]
        },
        data
      ).issues
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "COVERAGE_REVIEW_HISTORICAL_PERIOD" })
      ])
    );

    const available = data.entities.find(
      ({ entityKind, names }) =>
        entityKind === "polity" && names.local !== undefined && names.localLanguageTag !== undefined
    );
    if (!available) throw new Error("缺少已有本地名称的测试政权");
    expect(
      validateCoverageReviewData(
        {
          entries: [
            {
              entityId: available.id,
              dimension: "localNames",
              status: "pending-review",
              note: "待审查。"
            }
          ]
        },
        data
      ).issues
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "COVERAGE_REVIEW_CONFLICT" })])
    );
  });
});
