import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  asBoundaryEvidenceReviewDocument,
  validateBoundaryEvidenceProductionGate,
  validateBoundaryEvidenceReviewDocument,
  type LoadedBoundaryEvidenceReview
} from "../src/data/boundaryEvidenceReview";
import { validateCrownlineData } from "../src/domain/dataValidation";
import type { CrownlineData, GeographicBoundarySnapshot } from "../src/domain/types";
import { loadSourceData } from "./data-source";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Bind approval to all production fields, independent of JSON object key order. */
export function boundarySnapshotSha256(snapshot: GeographicBoundarySnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

async function readPinnedArtifact(
  root: string,
  path: string,
  expectedHash: string
): Promise<string> {
  const bytes = await readFile(join(root, path));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) throw new Error(`疆域证据文件哈希不一致：${path}`);
  return bytes.toString("utf8");
}

/** Load tool-only evidence; fail before generation can replace any published artifacts. */
export async function loadBoundaryEvidenceReview(
  sourceRoot = join(process.cwd(), "src", "data", "source"),
  sourceData?: CrownlineData
): Promise<LoadedBoundaryEvidenceReview> {
  const data = sourceData ?? (await loadSourceData(sourceRoot));
  const reviewRoot = join(sourceRoot, "reviews");
  const reviewPath = join(reviewRoot, "boundary-evidence-review.json");
  try {
    const input: unknown = JSON.parse(await readFile(reviewPath, "utf8"));
    const validation = validateBoundaryEvidenceReviewDocument(input);
    if (!validation.valid) {
      throw new Error(validation.issues.map(({ code, path }) => `${code}: ${path}`).join("\n"));
    }
    const document = asBoundaryEvidenceReviewDocument(input);
    const archives = await Promise.all(
      document.archives.map(async (archive) => {
        const input: unknown = JSON.parse(
          await readPinnedArtifact(reviewRoot, archive.path, archive.sha256)
        );
        const validation = validateCrownlineData({ ...data, boundarySnapshots: input });
        if (!validation.valid) throw new Error(`疆域归档结构无效：${archive.path}`);
        return { ...archive, snapshots: input as GeographicBoundarySnapshot[] };
      })
    );
    const gate = validateBoundaryEvidenceProductionGate(document, archives, data.boundarySnapshots);
    if (!gate.valid) {
      throw new Error(gate.issues.map(({ code, message }) => `${code}: ${message}`).join("\n"));
    }
    const polityIds = new Set(
      data.entities.filter(({ entityKind }) => entityKind === "polity").map(({ id }) => id)
    );
    for (const entry of document.entries) {
      if (!polityIds.has(entry.polityId))
        throw new Error(`疆域审查引用未知政权：${entry.polityId}`);
      if (entry.status !== "approved") continue;
      await readPinnedArtifact(reviewRoot, entry.sourceArtifactPath, entry.sourceArtifactSha256);
      const snapshot = data.boundarySnapshots.find(({ id }) => id === entry.snapshotId)!;
      if (boundarySnapshotSha256(snapshot) !== entry.snapshotSha256) {
        throw new Error(`生产疆域已改变，必须重新审查：${entry.snapshotId}`);
      }
    }
    return { document, archives };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`疆域证据审查失败 ${reviewPath}：${message}`);
  }
}
