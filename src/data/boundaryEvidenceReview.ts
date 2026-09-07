import type { GeographicBoundarySnapshot } from "../domain/types";

export const BOUNDARY_EVIDENCE_REVIEW_VERSION = 1 as const;

export const BOUNDARY_EVIDENCE_STATUSES = ["approved", "retired"] as const;

export const BOUNDARY_RETIREMENT_REASONS = [
  "missing-upstream-object-id",
  "missing-upstream-version",
  "missing-element-license-evidence",
  "missing-historical-source-evidence",
  "non-reproducible-derivation"
] as const;

export type BoundaryEvidenceStatus = (typeof BOUNDARY_EVIDENCE_STATUSES)[number];
export type BoundaryRetirementReason = (typeof BOUNDARY_RETIREMENT_REASONS)[number];

export interface BoundaryEvidenceArchiveDescriptor {
  path: string;
  sha256: string;
}

export interface BoundaryUpstreamRecordEvidence {
  datasetTitle: string;
  recordType: string;
  recordId: string;
  recordVersion: string;
  recordUrl: string;
  accessedAt: string;
  licenseName: string;
  licenseUrl: string;
  licenseEvidence: string;
  historicalSourceEvidence: string;
}

export interface BoundaryDerivationEvidence {
  inputCrs: string;
  outputCrs: "EPSG:4326";
  coordinateOrder: "longitude-latitude";
  method: string;
  steps: string[];
}

interface BoundaryEvidenceReviewEntryBase {
  snapshotId: string;
  polityId: string;
  note: string;
}

export interface ApprovedBoundaryEvidenceReviewEntry extends BoundaryEvidenceReviewEntryBase {
  status: "approved";
  sourceArtifactPath: string;
  sourceArtifactSha256: string;
  snapshotSha256: string;
  upstreamRecords: BoundaryUpstreamRecordEvidence[];
  derivation: BoundaryDerivationEvidence;
}

export interface RetiredBoundaryEvidenceReviewEntry extends BoundaryEvidenceReviewEntryBase {
  status: "retired";
  archivePath: string;
  reasonCodes: BoundaryRetirementReason[];
}

export type BoundaryEvidenceReviewEntry =
  ApprovedBoundaryEvidenceReviewEntry | RetiredBoundaryEvidenceReviewEntry;

export interface BoundaryEvidenceReviewDocument {
  schemaVersion: typeof BOUNDARY_EVIDENCE_REVIEW_VERSION;
  reviewedAt: string;
  archives: BoundaryEvidenceArchiveDescriptor[];
  entries: BoundaryEvidenceReviewEntry[];
}

export interface LoadedBoundaryEvidenceArchive extends BoundaryEvidenceArchiveDescriptor {
  snapshots: GeographicBoundarySnapshot[];
}

export interface LoadedBoundaryEvidenceReview {
  document: BoundaryEvidenceReviewDocument;
  archives: LoadedBoundaryEvidenceArchive[];
}

export interface BoundaryEvidenceValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface BoundaryEvidenceValidationResult {
  valid: boolean;
  issues: BoundaryEvidenceValidationIssue[];
}

export interface BoundaryEvidenceSummary {
  reviewedSnapshots: number;
  approvedForProduction: number;
  retiredSnapshots: number;
  archivedSnapshots: number;
  productionSnapshots: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEnumValue<const T extends readonly string[]>(
  value: unknown,
  values: T
): value is T[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function isValidUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSpecificRecordUrl(value: string, recordType: string, recordId: string): boolean {
  const url = new URL(value);
  const genericPaths = new Set(["/", "/about", "/copyright", "/reuse"]);
  if (genericPaths.has(url.pathname.replace(/\/$/, "") || "/")) return false;

  if (url.hostname === "openhistoricalmap.org" || url.hostname === "www.openhistoricalmap.org") {
    const match = url.pathname.match(/\/(relation|way)\/(\d+)(?:\/|$)/);
    return match?.[1] === recordType && match[2] === recordId;
  }

  return true;
}

function validateArchiveDescriptor(
  value: unknown,
  path: string,
  issues: BoundaryEvidenceValidationIssue[]
): value is BoundaryEvidenceArchiveDescriptor {
  if (!isRecord(value)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_ARCHIVE_SHAPE",
      path,
      message: "boundary evidence archive descriptor must be an object"
    });
    return false;
  }

  let valid = true;
  if (!isNonEmptyString(value.path) || value.path.startsWith("/") || value.path.includes("..")) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_ARCHIVE_PATH",
      path: `${path}/path`,
      message: "archive path must be a non-empty relative path without parent traversal"
    });
    valid = false;
  }
  if (!isNonEmptyString(value.sha256) || !SHA256_PATTERN.test(value.sha256)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_ARCHIVE_HASH",
      path: `${path}/sha256`,
      message: "archive sha256 must be a lowercase hexadecimal SHA-256 digest"
    });
    valid = false;
  }
  return valid;
}

function validateEntryBase(
  value: Record<string, unknown>,
  path: string,
  issues: BoundaryEvidenceValidationIssue[]
): boolean {
  let valid = true;
  for (const key of ["snapshotId", "polityId", "note"] as const) {
    if (!isNonEmptyString(value[key])) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_REQUIRED_TEXT",
        path: `${path}/${key}`,
        message: `${key} must be a non-empty string`
      });
      valid = false;
    }
  }
  return valid;
}

function validateUpstreamRecord(
  value: unknown,
  path: string,
  issues: BoundaryEvidenceValidationIssue[]
): value is BoundaryUpstreamRecordEvidence {
  if (!isRecord(value)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_UPSTREAM_SHAPE",
      path,
      message: "upstream record evidence must be an object"
    });
    return false;
  }

  let valid = true;
  for (const key of [
    "datasetTitle",
    "recordType",
    "recordId",
    "recordVersion",
    "licenseName",
    "licenseEvidence",
    "historicalSourceEvidence"
  ] as const) {
    if (!isNonEmptyString(value[key])) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_UPSTREAM_FIELD",
        path: `${path}/${key}`,
        message: `${key} must be a non-empty string`
      });
      valid = false;
    }
  }
  if (!isValidUrl(value.recordUrl)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_RECORD_URL",
      path: `${path}/recordUrl`,
      message: "recordUrl must be an absolute HTTP(S) URL"
    });
    valid = false;
  } else if (
    isNonEmptyString(value.recordType) &&
    isNonEmptyString(value.recordId) &&
    !isSpecificRecordUrl(value.recordUrl, value.recordType, value.recordId)
  ) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_GENERIC_RECORD_URL",
      path: `${path}/recordUrl`,
      message: "recordUrl must identify the reviewed upstream record, not a dataset landing page"
    });
    valid = false;
  }
  if (!isValidUrl(value.licenseUrl)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_LICENSE_URL",
      path: `${path}/licenseUrl`,
      message: "licenseUrl must be an absolute HTTP(S) URL"
    });
    valid = false;
  }
  if (!isNonEmptyString(value.accessedAt) || !DATE_PATTERN.test(value.accessedAt)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_ACCESSED_AT",
      path: `${path}/accessedAt`,
      message: "accessedAt must use YYYY-MM-DD"
    });
    valid = false;
  }
  return valid;
}

function validateDerivation(
  value: unknown,
  path: string,
  issues: BoundaryEvidenceValidationIssue[]
): value is BoundaryDerivationEvidence {
  if (!isRecord(value)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_DERIVATION_SHAPE",
      path,
      message: "derivation evidence must be an object"
    });
    return false;
  }

  let valid = true;
  for (const key of ["inputCrs", "method"] as const) {
    if (!isNonEmptyString(value[key])) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_DERIVATION_FIELD",
        path: `${path}/${key}`,
        message: `${key} must be a non-empty string`
      });
      valid = false;
    }
  }
  if (value.outputCrs !== "EPSG:4326") {
    issues.push({
      code: "BOUNDARY_EVIDENCE_OUTPUT_CRS",
      path: `${path}/outputCrs`,
      message: "production boundary output CRS must be EPSG:4326"
    });
    valid = false;
  }
  if (value.coordinateOrder !== "longitude-latitude") {
    issues.push({
      code: "BOUNDARY_EVIDENCE_COORDINATE_ORDER",
      path: `${path}/coordinateOrder`,
      message: "production coordinates must use longitude-latitude order"
    });
    valid = false;
  }
  if (
    !Array.isArray(value.steps) ||
    value.steps.length === 0 ||
    value.steps.some((step) => !isNonEmptyString(step))
  ) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_DERIVATION_STEPS",
      path: `${path}/steps`,
      message: "derivation must contain at least one non-empty reproducible step"
    });
    valid = false;
  }
  return valid;
}

function validateReviewEntry(
  value: unknown,
  path: string,
  issues: BoundaryEvidenceValidationIssue[]
): value is BoundaryEvidenceReviewEntry {
  if (!isRecord(value)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_ENTRY_SHAPE",
      path,
      message: "boundary evidence review entry must be an object"
    });
    return false;
  }

  let valid = validateEntryBase(value, path, issues);
  if (!isEnumValue(value.status, BOUNDARY_EVIDENCE_STATUSES)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_STATUS",
      path: `${path}/status`,
      message: `unknown boundary evidence status: ${String(value.status)}`
    });
    return false;
  }

  if (value.status === "retired") {
    if (!isNonEmptyString(value.archivePath)) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_ARCHIVE_PATH",
        path: `${path}/archivePath`,
        message: "retired boundary evidence must identify its archive"
      });
      valid = false;
    }
    if (
      !Array.isArray(value.reasonCodes) ||
      value.reasonCodes.length === 0 ||
      value.reasonCodes.some((reason) => !isEnumValue(reason, BOUNDARY_RETIREMENT_REASONS))
    ) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_RETIREMENT_REASON",
        path: `${path}/reasonCodes`,
        message: "retired boundary evidence must contain known reason codes"
      });
      valid = false;
    }
    return valid;
  }

  if (
    !isNonEmptyString(value.sourceArtifactPath) ||
    value.sourceArtifactPath.startsWith("/") ||
    value.sourceArtifactPath.includes("..")
  ) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_SOURCE_PATH",
      path: `${path}/sourceArtifactPath`,
      message: "source artifact must have a relative path without parent traversal"
    });
    valid = false;
  }
  if (!isNonEmptyString(value.snapshotSha256) || !SHA256_PATTERN.test(value.snapshotSha256)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_SNAPSHOT_HASH",
      path: `${path}/snapshotSha256`,
      message: "approved snapshot must be pinned with SHA-256"
    });
    valid = false;
  }
  if (
    !isNonEmptyString(value.sourceArtifactSha256) ||
    !SHA256_PATTERN.test(value.sourceArtifactSha256)
  ) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_SOURCE_HASH",
      path: `${path}/sourceArtifactSha256`,
      message: "approved boundary evidence must pin its source artifact with SHA-256"
    });
    valid = false;
  }
  if (!Array.isArray(value.upstreamRecords) || value.upstreamRecords.length === 0) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_UPSTREAM_REQUIRED",
      path: `${path}/upstreamRecords`,
      message: "approved boundary evidence must identify at least one upstream record"
    });
    valid = false;
  } else {
    value.upstreamRecords.forEach((record, index) => {
      if (!validateUpstreamRecord(record, `${path}/upstreamRecords/${index}`, issues)) {
        valid = false;
      }
    });
  }
  if (!validateDerivation(value.derivation, `${path}/derivation`, issues)) valid = false;
  return valid;
}

/** 校验工具侧审查文档本身；不涉及文件系统或生产数据。 */
export function validateBoundaryEvidenceReviewDocument(
  input: unknown
): BoundaryEvidenceValidationResult {
  const issues: BoundaryEvidenceValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [
        {
          code: "BOUNDARY_EVIDENCE_ROOT_SHAPE",
          path: "/",
          message: "boundary evidence review root must be an object"
        }
      ]
    };
  }

  if (input.schemaVersion !== BOUNDARY_EVIDENCE_REVIEW_VERSION) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_VERSION",
      path: "/schemaVersion",
      message: `boundary evidence review schemaVersion must be ${BOUNDARY_EVIDENCE_REVIEW_VERSION}`
    });
  }
  if (!isNonEmptyString(input.reviewedAt) || !DATE_PATTERN.test(input.reviewedAt)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_REVIEWED_AT",
      path: "/reviewedAt",
      message: "reviewedAt must use YYYY-MM-DD"
    });
  }

  const archivePaths = new Set<string>();
  if (!Array.isArray(input.archives)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_ARCHIVES_SHAPE",
      path: "/archives",
      message: "archives must be an array"
    });
  } else {
    input.archives.forEach((archive, index) => {
      const path = `/archives/${index}`;
      if (!validateArchiveDescriptor(archive, path, issues)) return;
      if (archivePaths.has(archive.path)) {
        issues.push({
          code: "BOUNDARY_EVIDENCE_DUPLICATE_ARCHIVE",
          path,
          message: `duplicate boundary archive path ${archive.path}`
        });
      }
      archivePaths.add(archive.path);
    });
  }

  const snapshotIds = new Set<string>();
  if (!Array.isArray(input.entries)) {
    issues.push({
      code: "BOUNDARY_EVIDENCE_ENTRIES_SHAPE",
      path: "/entries",
      message: "entries must be an array"
    });
  } else {
    input.entries.forEach((entry, index) => {
      const path = `/entries/${index}`;
      if (!validateReviewEntry(entry, path, issues)) return;
      if (snapshotIds.has(entry.snapshotId)) {
        issues.push({
          code: "BOUNDARY_EVIDENCE_DUPLICATE_REVIEW",
          path,
          message: `duplicate boundary evidence review for ${entry.snapshotId}`
        });
      }
      snapshotIds.add(entry.snapshotId);
      if (entry.status === "retired" && !archivePaths.has(entry.archivePath)) {
        issues.push({
          code: "BOUNDARY_EVIDENCE_UNKNOWN_ARCHIVE",
          path: `${path}/archivePath`,
          message: `retired review references unknown archive ${entry.archivePath}`
        });
      }
    });
  }

  return { valid: issues.length === 0, issues };
}

/** 从已通过文档校验的 unknown 值收窄为审查文档。 */
export function asBoundaryEvidenceReviewDocument(input: unknown): BoundaryEvidenceReviewDocument {
  const result = validateBoundaryEvidenceReviewDocument(input);
  if (!result.valid) throw new Error("cannot narrow invalid boundary evidence review document");
  return input as BoundaryEvidenceReviewDocument;
}

/**
 * 校验审查归档与生产快照的一致性。生产快照必须逐条获得 approved，retired 快照不得发布。
 */
export function validateBoundaryEvidenceProductionGate(
  review: BoundaryEvidenceReviewDocument,
  archives: readonly LoadedBoundaryEvidenceArchive[],
  productionSnapshots: readonly GeographicBoundarySnapshot[]
): BoundaryEvidenceValidationResult {
  const documentResult = validateBoundaryEvidenceReviewDocument(review);
  const issues = [...documentResult.issues];
  if (!documentResult.valid) return { valid: false, issues };

  const archivesByPath = new Map(archives.map((archive) => [archive.path, archive]));
  const archivedSnapshotIds = new Set<string>();
  archives.forEach((archive, archiveIndex) => {
    const descriptor = review.archives.find(({ path }) => path === archive.path);
    if (!descriptor) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_UNDECLARED_ARCHIVE",
        path: `/loadedArchives/${archiveIndex}`,
        message: `loaded archive ${archive.path} is not declared by the review document`
      });
    } else if (descriptor.sha256 !== archive.sha256) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_ARCHIVE_HASH_MISMATCH",
        path: `/loadedArchives/${archiveIndex}/sha256`,
        message: `archive ${archive.path} does not match its reviewed SHA-256 digest`
      });
    }
    archive.snapshots.forEach((snapshot, snapshotIndex) => {
      if (archivedSnapshotIds.has(snapshot.id)) {
        issues.push({
          code: "BOUNDARY_EVIDENCE_DUPLICATE_ARCHIVED_SNAPSHOT",
          path: `/loadedArchives/${archiveIndex}/snapshots/${snapshotIndex}`,
          message: `duplicate archived boundary snapshot ${snapshot.id}`
        });
      }
      archivedSnapshotIds.add(snapshot.id);
    });
  });
  review.archives.forEach((archive, index) => {
    if (!archivesByPath.has(archive.path)) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_ARCHIVE_NOT_LOADED",
        path: `/archives/${index}`,
        message: `declared boundary archive ${archive.path} was not loaded`
      });
    }
  });

  const reviewBySnapshotId = new Map(review.entries.map((entry) => [entry.snapshotId, entry]));
  const productionBySnapshotId = new Map(
    productionSnapshots.map((snapshot) => [snapshot.id, snapshot])
  );

  productionSnapshots.forEach((snapshot, index) => {
    const entry = reviewBySnapshotId.get(snapshot.id);
    if (!entry) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_APPROVAL_REQUIRED",
        path: `/productionSnapshots/${index}`,
        message: `production boundary ${snapshot.id} has no evidence review`
      });
    } else if (entry.status !== "approved") {
      issues.push({
        code: "BOUNDARY_EVIDENCE_RETIRED_IN_PRODUCTION",
        path: `/productionSnapshots/${index}`,
        message: `retired boundary ${snapshot.id} must not be published`
      });
    } else if (entry.polityId !== snapshot.polityId) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_POLITY_MISMATCH",
        path: `/productionSnapshots/${index}/polityId`,
        message: `production boundary ${snapshot.id} does not match reviewed polity ${entry.polityId}`
      });
    }
  });

  review.entries.forEach((entry, index) => {
    const production = productionBySnapshotId.get(entry.snapshotId);
    if (entry.status === "approved" && !production) {
      issues.push({
        code: "BOUNDARY_EVIDENCE_STALE_APPROVAL",
        path: `/entries/${index}`,
        message: `approved boundary ${entry.snapshotId} is missing from production`
      });
    }
    if (entry.status === "retired") {
      const archive = archivesByPath.get(entry.archivePath);
      const archived = archive?.snapshots.find(({ id }) => id === entry.snapshotId);
      if (!archived) {
        issues.push({
          code: "BOUNDARY_EVIDENCE_ARCHIVED_SNAPSHOT_MISSING",
          path: `/entries/${index}/archivePath`,
          message: `retired boundary ${entry.snapshotId} is missing from ${entry.archivePath}`
        });
      } else if (archived.polityId !== entry.polityId) {
        issues.push({
          code: "BOUNDARY_EVIDENCE_ARCHIVED_POLITY_MISMATCH",
          path: `/entries/${index}/polityId`,
          message: `archived boundary ${entry.snapshotId} does not match reviewed polity ${entry.polityId}`
        });
      }
    }
  });

  archivedSnapshotIds.forEach((snapshotId) => {
    const entry = reviewBySnapshotId.get(snapshotId);
    if (!entry || entry.status !== "retired") {
      issues.push({
        code: "BOUNDARY_EVIDENCE_ORPHAN_ARCHIVED_SNAPSHOT",
        path: "/loadedArchives",
        message: `archived boundary ${snapshotId} has no retired review entry`
      });
    }
  });

  return { valid: issues.length === 0, issues };
}

/** 为覆盖报告提供不含坐标的确定性工具侧摘要。 */
export function summarizeBoundaryEvidenceReview(
  review: LoadedBoundaryEvidenceReview,
  productionSnapshots: readonly GeographicBoundarySnapshot[]
): BoundaryEvidenceSummary {
  return {
    reviewedSnapshots: review.document.entries.length,
    approvedForProduction: review.document.entries.filter(({ status }) => status === "approved")
      .length,
    retiredSnapshots: review.document.entries.filter(({ status }) => status === "retired").length,
    archivedSnapshots: review.archives.reduce(
      (count, archive) => count + archive.snapshots.length,
      0
    ),
    productionSnapshots: productionSnapshots.length
  };
}
