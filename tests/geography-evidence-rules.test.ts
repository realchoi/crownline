import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import type { SourceRef } from "../src/domain/types";

interface ReviewEntry {
  recordId: string;
  sourcePath: string;
  reviewStatus: "verified" | "pending-evidence";
  outcome?: string;
  baselineSourceRefs?: SourceRef[];
  currentSourceRefs: SourceRef[];
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

/** 通用 GeoNames 首页只说明数据库存在，不能对应到具体坐标对象。 */
const GENERIC_GEONAMES_SOURCE_ID = "source-geonames";
/** 政权纪年表只能支撑存续年代，不能推出都城或政治中心。 */
const CHRONOLOGY_TABLE_SOURCE_ID = "source-cn-chronology-table";
const HISTORICAL_SOURCE_TYPES = new Set(["primary", "institutional", "secondary"]);

const data = await loadSourceData();
const sourceById = new Map(data.sources.map((source) => [source.id, source]));
const review = JSON.parse(
  readFileSync("src/data/source/reviews/geography-locator-evidence-review.json", "utf8")
) as ReviewDocument;
const entries = review.groups.flatMap(({ entries: groupEntries }) => groupEntries);
const entryById = new Map(entries.map((entry) => [entry.recordId, entry]));

const isLocated = ({ locator }: SourceRef) => Boolean(locator?.trim());
const geographyRefs = data.geographicSnapshots.flatMap((snapshot) =>
  snapshot.sourceRefs.map((sourceRef) => ({ snapshot, sourceRef }))
);

describe("点位来源证据规则", () => {
  it("通用 GeoNames 首页不能靠补写 locator 冒充具体坐标对象", () => {
    for (const { snapshot, sourceRef } of geographyRefs) {
      if (sourceRef.sourceId !== GENERIC_GEONAMES_SOURCE_ID) continue;
      expect(isLocated(sourceRef), snapshot.id).toBe(false);
    }
  });

  it("其余坐标数据集引用都必须定位到具体对象", () => {
    for (const { snapshot, sourceRef } of geographyRefs) {
      if (sourceRef.sourceId === GENERIC_GEONAMES_SOURCE_ID) continue;
      if (sourceById.get(sourceRef.sourceId)?.sourceType !== "dataset") continue;
      expect(isLocated(sourceRef), `${snapshot.id} → ${sourceRef.sourceId}`).toBe(true);
    }
  });

  it("全部引用已定位的点位至少有一项历史地点依据", () => {
    for (const snapshot of data.geographicSnapshots) {
      if (!snapshot.sourceRefs.every(isLocated)) continue;
      expect(
        snapshot.sourceRefs.some(({ sourceId }) =>
          HISTORICAL_SOURCE_TYPES.has(sourceById.get(sourceId)?.sourceType ?? "")
        ),
        snapshot.id
      ).toBe(true);
    }
  });

  it("政权纪年表不能单独支撑点位，引用它的点位仍须登记待补证据", () => {
    for (const { snapshot, sourceRef } of geographyRefs) {
      if (sourceRef.sourceId !== CHRONOLOGY_TABLE_SOURCE_ID) continue;
      expect(isLocated(sourceRef), snapshot.id).toBe(false);
      expect(entryById.get(snapshot.id)?.reviewStatus, snapshot.id).toBe("pending-evidence");
    }
  });

  it("每条点位说明都披露点位的限制", () => {
    for (const snapshot of data.geographicSnapshots) {
      expect(snapshot.positionNote, snapshot.id).toMatch(/不表示|不把|不是|不代表|不暗示|不冒充/);
    }
  });
});

describe("点位 locator 证据审查档案", () => {
  it("摘要与逐条记录一致，且每条记录只登记一次", () => {
    const verified = entries.filter(({ reviewStatus }) => reviewStatus === "verified");
    const pending = entries.filter(({ reviewStatus }) => reviewStatus === "pending-evidence");

    expect(entryById.size).toBe(entries.length);
    expect(review.summary.baselineRecords).toBe(entries.length);
    expect(review.summary.verifiedThisReview).toBe(verified.length);
    expect(review.summary.pendingEvidence).toBe(pending.length);
    expect(verified.length + pending.length).toBe(entries.length);
    expect(review.summary.correctedThisReview).toBeLessThanOrEqual(verified.length);
  });

  it("每条记录保留源路径、与业务数据一致的引用和三项证据结论", () => {
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

  it("待补证据记录没有任何定位，并写明后续核查要求", () => {
    for (const entry of entries) {
      if (entry.reviewStatus !== "pending-evidence") continue;
      expect(
        entry.currentSourceRefs.some(({ sourceId }) => sourceId === GENERIC_GEONAMES_SOURCE_ID),
        entry.recordId
      ).toBe(true);
      expect(entry.currentSourceRefs.some(isLocated), entry.recordId).toBe(false);
      expect(entry.requiredFollowUp?.trim(), entry.recordId).toBeTruthy();
      expect(entry.outcome, entry.recordId).toBeUndefined();
    }
  });

  it("已核实记录的全部引用都带具体 locator", () => {
    for (const entry of entries) {
      if (entry.reviewStatus !== "verified") continue;
      expect(entry.currentSourceRefs.every(isLocated), entry.recordId).toBe(true);
    }
  });

  it("生产中完全无定位的点位都已登记为待补证据", () => {
    for (const snapshot of data.geographicSnapshots) {
      if (snapshot.sourceRefs.some(isLocated)) continue;
      expect(entryById.get(snapshot.id)?.reviewStatus, snapshot.id).toBe("pending-evidence");
    }
  });
});
