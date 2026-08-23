import type { CrownlineData, HistoricalEntity } from "../domain/types";

export const COVERAGE_REVIEW_DIMENSIONS = ["rulerDetails", "localNames", "geography"] as const;

export const COVERAGE_REVIEW_STATUSES = [
  "available",
  "reviewed-unavailable",
  "not-applicable",
  "pending-review"
] as const;

export type CoverageReviewDimension = (typeof COVERAGE_REVIEW_DIMENSIONS)[number];
export type CoverageReviewStatus = (typeof COVERAGE_REVIEW_STATUSES)[number];

export interface CoverageReviewEntry {
  entityId: string;
  dimension: CoverageReviewDimension;
  status: CoverageReviewStatus;
  note: string;
}

export interface CoverageReviewData {
  entries: CoverageReviewEntry[];
}

export interface CoverageReviewValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface CoverageReviewValidationResult {
  valid: boolean;
  issues: CoverageReviewValidationIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isEnumValue<const T extends readonly string[]>(
  value: unknown,
  values: T
): value is T[number] {
  return isString(value) && values.some((candidate) => candidate === value);
}

export function isCoverageDimensionAvailable(
  data: CrownlineData,
  entity: HistoricalEntity,
  dimension: CoverageReviewDimension
): boolean {
  switch (dimension) {
    case "rulerDetails": {
      const personIds = new Set(data.persons.map(({ id }) => id));
      const reigns = data.reigns.filter(({ polityId }) => polityId === entity.id);
      return reigns.length > 0 && reigns.every(({ personId }) => personIds.has(personId));
    }
    case "localNames":
      return entity.names.local !== undefined && entity.names.localLanguageTag !== undefined;
    case "geography":
      return data.geographicSnapshots.some(({ polityId }) => polityId === entity.id);
  }
}

function validateEntryShape(
  value: unknown,
  path: string,
  issues: CoverageReviewValidationIssue[]
): value is CoverageReviewEntry {
  if (!isRecord(value)) {
    issues.push({
      code: "COVERAGE_REVIEW_ENTRY_SHAPE",
      path,
      message: "coverage review entry must be an object"
    });
    return false;
  }

  const entityId = value.entityId;
  const dimension = value.dimension;
  const status = value.status;
  const note = value.note;
  let valid = true;

  if (!isString(entityId) || entityId.trim().length === 0) {
    issues.push({
      code: "COVERAGE_REVIEW_ENTITY_ID",
      path: `${path}/entityId`,
      message: "coverage review entityId must be a non-empty string"
    });
    valid = false;
  }
  if (!isEnumValue(dimension, COVERAGE_REVIEW_DIMENSIONS)) {
    issues.push({
      code: "COVERAGE_REVIEW_DIMENSION",
      path: `${path}/dimension`,
      message: `unknown coverage review dimension: ${String(dimension)}`
    });
    valid = false;
  }
  if (!isEnumValue(status, COVERAGE_REVIEW_STATUSES)) {
    issues.push({
      code: "COVERAGE_REVIEW_STATUS",
      path: `${path}/status`,
      message: `unknown coverage review status: ${String(status)}`
    });
    valid = false;
  }
  if (!isString(note) || note.trim().length === 0) {
    issues.push({
      code: "COVERAGE_REVIEW_NOTE",
      path: `${path}/note`,
      message: "coverage review note must be a non-empty string"
    });
    valid = false;
  }
  return valid;
}

/** 校验工具侧覆盖审查目录的结构、引用、重复记录和业务状态冲突。 */
export function validateCoverageReviewData(
  input: unknown,
  data?: CrownlineData
): CoverageReviewValidationResult {
  const issues: CoverageReviewValidationIssue[] = [];
  if (!isRecord(input) || !Array.isArray(input.entries)) {
    return {
      valid: false,
      issues: [
        {
          code: "COVERAGE_REVIEW_ROOT_SHAPE",
          path: "/entries",
          message: "coverage review root must contain an entries array"
        }
      ]
    };
  }

  const keys = new Set<string>();
  const entries: CoverageReviewEntry[] = [];
  input.entries.forEach((entry, index) => {
    const path = `/entries/${index}`;
    if (!validateEntryShape(entry, path, issues)) return;
    const key = `${entry.entityId}\u0000${entry.dimension}`;
    if (keys.has(key)) {
      issues.push({
        code: "COVERAGE_REVIEW_DUPLICATE",
        path,
        message: `duplicate coverage review entry for ${entry.entityId}/${entry.dimension}`
      });
    } else {
      keys.add(key);
    }
    entries.push(entry);
  });

  if (data) {
    const entityById = new Map(data.entities.map((entity) => [entity.id, entity]));
    entries.forEach((entry, index) => {
      const path = `/entries/${index}`;
      const entity = entityById.get(entry.entityId);
      if (!entity) {
        issues.push({
          code: "COVERAGE_REVIEW_UNKNOWN_ENTITY",
          path: `${path}/entityId`,
          message: `coverage review references unknown entity ${entry.entityId}`
        });
        return;
      }
      if (entity.entityKind !== "polity") {
        issues.push({
          code: "COVERAGE_REVIEW_HISTORICAL_PERIOD",
          path: `${path}/entityId`,
          message: `coverage review entity ${entry.entityId} is not a polity`
        });
        return;
      }

      const available = isCoverageDimensionAvailable(data, entity, entry.dimension);
      if (available && entry.status !== "available") {
        issues.push({
          code: "COVERAGE_REVIEW_CONFLICT",
          path: `${path}/status`,
          message: `coverage review status ${entry.status} conflicts with available ${entry.entityId}/${entry.dimension}`
        });
      } else if (!available && entry.status === "available") {
        issues.push({
          code: "COVERAGE_REVIEW_CONFLICT",
          path: `${path}/status`,
          message: `coverage review marks unavailable ${entry.entityId}/${entry.dimension} as available`
        });
      }
    });
  }

  return { valid: issues.length === 0, issues };
}

/** 从已经通过校验的未知值收窄出覆盖审查数据。 */
export function asCoverageReviewData(input: unknown): CoverageReviewData {
  if (!validateCoverageReviewData(input).valid) {
    throw new Error("cannot narrow invalid value to coverage review data");
  }
  return input as CoverageReviewData;
}
