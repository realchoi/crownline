import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import {
  boundarySnapshotSha256,
  loadBoundaryEvidenceReview
} from "../scripts/boundary-evidence-review";
import {
  asBoundaryEvidenceReviewDocument,
  summarizeBoundaryEvidenceReview,
  validateBoundaryEvidenceProductionGate,
  validateBoundaryEvidenceReviewDocument,
  type ApprovedBoundaryEvidenceReviewEntry,
  type BoundaryEvidenceReviewDocument
} from "../src/data/boundaryEvidenceReview";
import { createBoundaryFixture } from "./helpers/boundaryFixtures";

const data = await loadSourceData();
const review = await loadBoundaryEvidenceReview(undefined, data);
const roots: string[] = [];
const snapshot = createBoundaryFixture().boundarySnapshots[0]!;
const sourceArtifact = "Synthetic test input, not historical evidence.";
const approved: ApprovedBoundaryEvidenceReviewEntry = {
  snapshotId: snapshot.id,
  polityId: snapshot.polityId,
  status: "approved",
  note: "Test approval only",
  snapshotSha256: boundarySnapshotSha256(snapshot),
  sourceArtifactPath: "upstream.txt",
  sourceArtifactSha256: createHash("sha256").update(sourceArtifact).digest("hex"),
  upstreamRecords: [
    {
      datasetTitle: "Synthetic test input",
      recordType: "fixture",
      recordId: "rectangles",
      recordVersion: "1",
      recordUrl: "https://example.test/rectangles",
      accessedAt: "2026-09-07",
      licenseName: "Test fixture",
      licenseUrl: "https://example.test/license",
      licenseEvidence: "Fixture authored for tests",
      historicalSourceEvidence: "No historical claim"
    }
  ],
  derivation: {
    inputCrs: "EPSG:4326",
    outputCrs: "EPSG:4326",
    coordinateOrder: "longitude-latitude",
    method: "Test rectangle",
    steps: ["Use the explicitly synthetic fixture."]
  }
};
function approvedDocument(): BoundaryEvidenceReviewDocument {
  return {
    schemaVersion: 1,
    reviewedAt: "2026-09-07",
    archives: [],
    entries: [structuredClone(approved)]
  };
}
async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "crownline-boundary-evidence-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("疆域证据与生产门禁", () => {
  it("八条旧快照保留可校验归档但全部退出生产", () => {
    expect(data.boundarySnapshots).toEqual([]);
    expect(summarizeBoundaryEvidenceReview(review, data.boundarySnapshots)).toEqual({
      reviewedSnapshots: 8,
      approvedForProduction: 0,
      retiredSnapshots: 8,
      archivedSnapshots: 8,
      productionSnapshots: 0
    });
    expect(validateBoundaryEvidenceProductionGate(review.document, review.archives, [])).toEqual({
      valid: true,
      issues: []
    });
    expect(
      validateBoundaryEvidenceProductionGate(
        review.document,
        review.archives,
        review.archives[0]!.snapshots
      ).issues
    ).toContainEqual(expect.objectContaining({ code: "BOUNDARY_EVIDENCE_RETIRED_IN_PRODUCTION" }));
    expect(
      validateBoundaryEvidenceProductionGate(review.document, review.archives, [snapshot]).issues
    ).toContainEqual(expect.objectContaining({ code: "BOUNDARY_EVIDENCE_APPROVAL_REQUIRED" }));
  });

  it("批准记录须定位证据，且政权和生产记录一一对应", () => {
    const doc = approvedDocument();
    expect(validateBoundaryEvidenceProductionGate(doc, [], [snapshot]).valid).toBe(true);
    expect(validateBoundaryEvidenceProductionGate(doc, [], []).issues).toContainEqual(
      expect.objectContaining({ code: "BOUNDARY_EVIDENCE_STALE_APPROVAL" })
    );
    expect(
      validateBoundaryEvidenceProductionGate(doc, [], [{ ...snapshot, polityId: "polity-other" }])
        .issues
    ).toContainEqual(expect.objectContaining({ code: "BOUNDARY_EVIDENCE_POLITY_MISMATCH" }));
  });

  it.each([
    ["schemaVersion", 2],
    ["reviewedAt", "bad"],
    ["archives", null],
    ["entries", null]
  ])("拒绝错误文档字段 %s", (key, value) => {
    expect(
      validateBoundaryEvidenceReviewDocument({ ...approvedDocument(), [key]: value }).valid
    ).toBe(false);
  });
  it("拒绝非对象、重复审查、无效归档及未知归档引用", () => {
    for (const input of [null, [], "bad"]) {
      expect(validateBoundaryEvidenceReviewDocument(input).valid).toBe(false);
      expect(() => asBoundaryEvidenceReviewDocument(input)).toThrow();
    }
    const doc = approvedDocument();
    doc.entries.push(structuredClone(approved));
    expect(validateBoundaryEvidenceReviewDocument(doc).valid).toBe(false);
    for (const archive of [null, { path: "../bad", sha256: "bad" }, { path: "", sha256: "" }]) {
      expect(
        validateBoundaryEvidenceReviewDocument({ ...approvedDocument(), archives: [archive] }).valid
      ).toBe(false);
    }
    const retired = structuredClone(review.document);
    retired.archives.push(retired.archives[0]!);
    expect(validateBoundaryEvidenceReviewDocument(retired).valid).toBe(false);
    retired.archives = [];
    expect(validateBoundaryEvidenceReviewDocument(retired).valid).toBe(false);
  });

  it.each([
    ["snapshotId", ""],
    ["polityId", null],
    ["note", " "],
    ["status", "pending"],
    ["sourceArtifactPath", "../bad"],
    ["sourceArtifactSha256", "bad"],
    ["snapshotSha256", ""],
    ["upstreamRecords", []],
    ["upstreamRecords", [null]],
    ["derivation", null]
  ])("批准审查拒绝错误字段 %s", (key, value) => {
    const doc = approvedDocument();
    expect(
      validateBoundaryEvidenceReviewDocument({ ...doc, entries: [{ ...approved, [key]: value }] })
        .valid
    ).toBe(false);
  });
  it("拒绝非对象审查和没有原因的退役审查", () => {
    for (const entry of [
      null,
      { ...review.document.entries[0], archivePath: "", reasonCodes: [] },
      { ...review.document.entries[0], reasonCodes: ["unknown"] }
    ]) {
      expect(
        validateBoundaryEvidenceReviewDocument({ ...review.document, entries: [entry] }).valid
      ).toBe(false);
    }
  });
  it.each([
    ["recordId", ""],
    ["recordVersion", ""],
    ["recordUrl", "https://www.openhistoricalmap.org/copyright"],
    ["recordUrl", "invalid"],
    ["recordUrl", "file:///tmp/input"],
    ["licenseUrl", null],
    ["accessedAt", "bad"],
    ["licenseEvidence", ""],
    ["historicalSourceEvidence", ""]
  ])("上游证据拒绝错误字段 %s", (key, value) => {
    const doc = approvedDocument();
    const entry = doc.entries[0] as ApprovedBoundaryEvidenceReviewEntry;
    entry.upstreamRecords[0] = { ...entry.upstreamRecords[0]!, [key]: value };
    expect(validateBoundaryEvidenceReviewDocument(doc).valid).toBe(false);
  });
  it("OHM 对象链接必须匹配其类型和 ID", () => {
    const doc = approvedDocument();
    const record = (doc.entries[0] as ApprovedBoundaryEvidenceReviewEntry).upstreamRecords[0]!;
    Object.assign(record, {
      recordType: "relation",
      recordId: "123",
      recordUrl: "https://www.openhistoricalmap.org/relation/123"
    });
    expect(validateBoundaryEvidenceReviewDocument(doc).valid).toBe(true);
    record.recordId = "456";
    expect(validateBoundaryEvidenceReviewDocument(doc).valid).toBe(false);
  });
  it.each([
    ["inputCrs", ""],
    ["method", ""],
    ["outputCrs", "EPSG:3857"],
    ["coordinateOrder", "latitude-longitude"],
    ["steps", []],
    ["steps", [""]]
  ])("派生过程拒绝错误字段 %s", (key, value) => {
    const doc = approvedDocument();
    const entry = doc.entries[0] as ApprovedBoundaryEvidenceReviewEntry;
    Object.assign(entry.derivation, { [key]: value });
    expect(validateBoundaryEvidenceReviewDocument(doc).valid).toBe(false);
  });

  it("拒绝归档缺失、篡改、孤立记录和政权错配", () => {
    expect(validateBoundaryEvidenceProductionGate(review.document, [], []).valid).toBe(false);
    const archives = structuredClone(review.archives);
    archives[0]!.sha256 = "0".repeat(64);
    archives[0]!.snapshots[0]!.polityId = "polity-other";
    archives[0]!.snapshots.push(archives[0]!.snapshots[0]!);
    archives.push({ path: "undeclared.json", sha256: "0".repeat(64), snapshots: [snapshot] });
    const result = validateBoundaryEvidenceProductionGate(review.document, archives, []);
    for (const code of [
      "BOUNDARY_EVIDENCE_ARCHIVE_HASH_MISMATCH",
      "BOUNDARY_EVIDENCE_ARCHIVED_POLITY_MISMATCH",
      "BOUNDARY_EVIDENCE_DUPLICATE_ARCHIVED_SNAPSHOT",
      "BOUNDARY_EVIDENCE_UNDECLARED_ARCHIVE",
      "BOUNDARY_EVIDENCE_ORPHAN_ARCHIVED_SNAPSHOT"
    ]) {
      expect(result.issues).toContainEqual(expect.objectContaining({ code }));
    }
    expect(
      validateBoundaryEvidenceProductionGate(
        { ...review.document, schemaVersion: 2 } as never,
        [],
        []
      ).valid
    ).toBe(false);
  });

  it("文件读取校验真实哈希，缺失或损坏审查不能静默通过", async () => {
    const root = await temporaryRoot();
    await expect(loadBoundaryEvidenceReview(root, data)).rejects.toThrow("疆域证据审查失败");
    await cp(join(process.cwd(), "src/data/source/reviews"), join(root, "reviews"), {
      recursive: true
    });
    const archive = join(root, "reviews", review.document.archives[0]!.path);
    await writeFile(archive, `${await readFile(archive, "utf8")} `);
    await expect(loadBoundaryEvidenceReview(root, data)).rejects.toThrow("哈希不一致");
    await writeFile(join(root, "reviews/boundary-evidence-review.json"), "{}");
    await expect(loadBoundaryEvidenceReview(root, data)).rejects.toThrow(
      "BOUNDARY_EVIDENCE_VERSION"
    );
    await writeFile(join(root, "reviews/boundary-evidence-review.json"), "{");
    await expect(loadBoundaryEvidenceReview(root, data)).rejects.toThrow("疆域证据审查失败");
  });

  it("批准绑定源文件与生产内容，坐标、年代或说明修改后须重新审查", async () => {
    const root = await temporaryRoot();
    await mkdir(join(root, "reviews"));
    await writeFile(
      join(root, "reviews/boundary-evidence-review.json"),
      JSON.stringify(approvedDocument())
    );
    await writeFile(join(root, "reviews/upstream.txt"), sourceArtifact);
    const fixture = { ...data, boundarySnapshots: [snapshot] };
    expect((await loadBoundaryEvidenceReview(root, fixture)).document.entries).toHaveLength(1);
    for (const changed of [
      { ...snapshot, boundaryNote: "changed" },
      {
        ...snapshot,
        periods: [
          {
            start: { year: 751, precision: "exact" as const },
            end: { year: 861, precision: "exact" as const }
          }
        ]
      }
    ]) {
      await expect(
        loadBoundaryEvidenceReview(root, { ...fixture, boundarySnapshots: [changed] })
      ).rejects.toThrow("必须重新审查");
    }
    expect(boundarySnapshotSha256({ ...snapshot, id: snapshot.id })).toBe(
      boundarySnapshotSha256(snapshot)
    );
    await writeFile(join(root, "reviews/upstream.txt"), "modified source");
    await expect(loadBoundaryEvidenceReview(root, fixture)).rejects.toThrow("哈希不一致");
  });
});
