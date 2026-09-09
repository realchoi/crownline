import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";

interface ReviewEntry {
  recordId: string;
  sourcePath: string;
  reviewStatus: "verified" | "pending-evidence";
  baselineSourceRefs?: Array<{ sourceId: string }>;
  currentSourceRefs: Array<{ sourceId: string; locator?: string }>;
  findings: {
    coordinateEvidence: string;
    historicalIdentity: string;
    temporalApplicability: string;
  };
  requiredFollowUp?: string;
}

interface ReviewDocument {
  summary: {
    baselineRecords: number;
    verifiedThisReview: number;
    correctedThisReview: number;
    pendingEvidence: number;
  };
  groups: Array<{ id: string; entries: ReviewEntry[] }>;
}

const review = JSON.parse(
  readFileSync("src/data/source/reviews/geography-locator-evidence-review.json", "utf8")
) as ReviewDocument;
const entries = review.groups.flatMap(({ entries }) => entries);
const data = await loadSourceData();

describe("既有点位 locator 证据审查", () => {
  it("逐条覆盖基线100条并明确区分已核实与待查", () => {
    expect(review.summary).toEqual({
      baselineRecords: 100,
      verifiedThisReview: 9,
      correctedThisReview: 4,
      pendingEvidence: 91
    });
    expect(entries).toHaveLength(100);
    expect(new Set(entries.map(({ recordId }) => recordId)).size).toBe(100);
    expect(review.groups.map(({ id }) => id)).toEqual([
      "china",
      "other-asia",
      "europe",
      "africa",
      "americas"
    ]);
  });

  it("保留每条记录的源路径、引用与三项证据结论", () => {
    for (const entry of entries) {
      expect(existsSync(entry.sourcePath), entry.recordId).toBe(true);
      expect(entry.currentSourceRefs.length, entry.recordId).toBeGreaterThan(0);
      expect(
        data.geographicSnapshots.find(({ id }) => id === entry.recordId)?.sourceRefs,
        entry.recordId
      ).toEqual(entry.currentSourceRefs);
      expect(entry.findings.coordinateEvidence.trim(), entry.recordId).not.toBe("");
      expect(entry.findings.historicalIdentity.trim(), entry.recordId).not.toBe("");
      expect(entry.findings.temporalApplicability.trim(), entry.recordId).not.toBe("");
    }
  });

  it("不把通用 GeoNames 首页或仅有纪年表的记录标成已核实", () => {
    const pending = entries.filter(({ reviewStatus }) => reviewStatus === "pending-evidence");
    expect(pending).toHaveLength(91);
    for (const entry of pending) {
      expect(entry.currentSourceRefs.some(({ sourceId }) => sourceId === "source-geonames")).toBe(
        true
      );
      expect(entry.currentSourceRefs.every(({ locator }) => !locator?.trim())).toBe(true);
      expect(entry.requiredFollowUp?.trim(), entry.recordId).not.toBe("");
    }

    const chronologyTableEntries = entries.filter((entry) =>
      (entry.baselineSourceRefs ?? entry.currentSourceRefs).some(
        ({ sourceId }) => sourceId === "source-cn-chronology-table"
      )
    );
    expect(chronologyTableEntries).toHaveLength(24);
    expect(
      chronologyTableEntries.filter(({ reviewStatus }) => reviewStatus === "verified")
    ).toHaveLength(8);
    expect(
      chronologyTableEntries.filter(({ reviewStatus }) => reviewStatus === "pending-evidence")
    ).toHaveLength(16);
  });

  it("已核实记录均已换成带具体 locator 的引用", () => {
    const verified = entries.filter(({ reviewStatus }) => reviewStatus === "verified");
    expect(verified).toHaveLength(9);
    for (const entry of verified) {
      expect(entry.currentSourceRefs.every(({ locator }) => Boolean(locator?.trim()))).toBe(true);
    }
    expect(
      verified.find(({ recordId }) => recordId === "geo-yuan-dadu")?.findings.temporalApplicability
    ).toContain("1272");
  });

  it("把四条误用政权起止年的点位区间改为有直接依据的年份", () => {
    const periods = Object.fromEntries(
      ["geo-western-han-changan", "geo-sui-daxing", "geo-tang-changan", "geo-yuan-dadu"].map(
        (id) => [id, data.geographicSnapshots.find((snapshot) => snapshot.id === id)?.periods]
      )
    );

    expect(periods).toEqual({
      "geo-western-han-changan": [
        { start: { year: -200, precision: "exact" }, end: { year: 8, precision: "exact" } }
      ],
      "geo-sui-daxing": [
        { start: { year: 583, precision: "exact" }, end: { year: 618, precision: "exact" } }
      ],
      "geo-tang-changan": [
        { start: { year: 618, precision: "exact" }, end: { year: 690, precision: "exact" } },
        { start: { year: 705, precision: "exact" }, end: { year: 904, precision: "exact" } }
      ],
      "geo-yuan-dadu": [
        { start: { year: 1272, precision: "exact" }, end: { year: 1368, precision: "exact" } }
      ]
    });
  });
});
