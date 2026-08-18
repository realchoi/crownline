import type { ValidationIssue, ValidationResult } from "../domain/dataValidation";
import { isValidLanguageTag } from "../domain/entityNames";
import {
  CHRONOLOGY_STATUSES,
  CONFIDENCE_LEVELS,
  CROWNLINE_SCHEMA_VERSION,
  DATE_PRECISIONS,
  DISPLAY_CATEGORIES,
  ENTITY_KINDS,
  GEOGRAPHIC_ROLES,
  POSITION_PRECISIONS,
  POLITY_FORMS,
  REGION_COVERAGE_STATUSES,
  REGION_KINDS,
  REIGN_ROLES,
  SOURCE_TYPES,
  type CrownlineDetail,
  type CrownlineGeography,
  type CrownlineIndex,
  type GeographicSnapshot,
  type Source
} from "../domain/types";

export interface GeographyLoadResult {
  geography: CrownlineGeography;
  omittedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isEnumValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values
): value is Values[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function hasNames(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.primary) ||
    !Array.isArray(value.aliases) ||
    !value.aliases.every(isNonEmptyString)
  ) {
    return false;
  }
  const hasLocal = typeof value.local === "string" && value.local.trim().length > 0;
  const hasLanguageTag = isValidLanguageTag(value.localLanguageTag);
  return value.local === undefined && value.localLanguageTag === undefined
    ? true
    : hasLocal && hasLanguageTag;
}

function hasPeriods(value: unknown, requireNonEmpty = false): boolean {
  return (
    Array.isArray(value) &&
    (!requireNonEmpty || value.length > 0) &&
    value.every((period) => {
      return (
        isRecord(period) &&
        isRecord(period.start) &&
        isRecord(period.end) &&
        Number.isInteger(period.start.year) &&
        period.start.year !== 0 &&
        isEnumValue(period.start.precision, DATE_PRECISIONS) &&
        Number.isInteger(period.end.year) &&
        period.end.year !== 0 &&
        isEnumValue(period.end.precision, DATE_PRECISIONS) &&
        (period.start.year as number) <= (period.end.year as number)
      );
    })
  );
}

function hasSourceRefs(value: unknown, sourceIds?: Set<string>, requireNonEmpty = true): boolean {
  return (
    Array.isArray(value) &&
    (!requireNonEmpty || value.length > 0) &&
    value.every((ref) => {
      return (
        isRecord(ref) &&
        isNonEmptyString(ref.sourceId) &&
        (!sourceIds || sourceIds.has(ref.sourceId)) &&
        (ref.locator === undefined || typeof ref.locator === "string") &&
        (ref.note === undefined || typeof ref.note === "string")
      );
    })
  );
}

function hasChronologyPolicy(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.calendar === "historical-year" &&
    value.hasYearZero === false &&
    value.intervalBoundary === "inclusive" &&
    value.yearSelection === "exists-at-any-time-during-year"
  );
}

function hasTimelineRange(value: unknown): boolean {
  return (
    isRecord(value) &&
    Number.isInteger(value.startYear) &&
    value.startYear !== 0 &&
    Number.isInteger(value.endYear) &&
    value.endYear !== 0 &&
    (value.startYear as number) <= (value.endYear as number)
  );
}

function hasCoverage(value: unknown): boolean {
  return (
    isRecord(value) &&
    isEnumValue(value.status, REGION_COVERAGE_STATUSES) &&
    isNonEmptyString(value.note)
  );
}

function hasAlternativeChronologies(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (alternative) =>
          isRecord(alternative) &&
          isNonEmptyString(alternative.label) &&
          hasPeriods(alternative.existencePeriods, true) &&
          isNonEmptyString(alternative.note) &&
          hasSourceRefs(alternative.sourceRefs)
      ))
  );
}

function isValidSource(value: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isEnumValue(value.sourceType, SOURCE_TYPES) &&
    isNonEmptyString(value.citation) &&
    (value.authors === undefined || isStringArray(value.authors)) &&
    isOptionalString(value.publisher) &&
    isOptionalString(value.url) &&
    isOptionalString(value.accessedAt)
  );
}

function isValidGeographicSnapshot(
  value: unknown,
  sourceIds: Set<string>
): value is GeographicSnapshot {
  if (!isRecord(value) || !isRecord(value.coordinates)) return false;
  const { latitude, longitude } = value.coordinates;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.polityId === "string" &&
    value.polityId.length > 0 &&
    hasPeriods(value.periods, true) &&
    typeof value.placeName === "string" &&
    value.placeName.trim().length > 0 &&
    GEOGRAPHIC_ROLES.some((role) => role === value.role) &&
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    POSITION_PRECISIONS.some((precision) => precision === value.positionPrecision) &&
    typeof value.positionNote === "string" &&
    value.positionNote.trim().length > 0 &&
    hasSourceRefs(value.sourceRefs, sourceIds) &&
    CONFIDENCE_LEVELS.some((confidence) => confidence === value.confidence) &&
    (value.confidenceNote === undefined || typeof value.confidenceNote === "string")
  );
}

function requireField(
  records: Record<string, unknown>[],
  path: string,
  key: string,
  valid: (value: unknown) => boolean,
  issues: ValidationIssue[]
): void {
  records.forEach((record, index) => {
    if (!valid(record[key])) {
      issues.push({
        code: "SCHEMA_ERROR",
        path: `${path}/${index}/${key}`,
        message: `${key} 缺失或格式错误`
      });
    }
  });
}

function requireRecordArray(
  input: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[]
): Record<string, unknown>[] {
  const value = input[key];
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    issues.push({ code: "SCHEMA_ERROR", path: `/${key}`, message: `${key} 必须是对象数组` });
    return [];
  }
  return value as Record<string, unknown>[];
}

function requireOpaqueArray(
  input: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[]
): unknown[] {
  const value = input[key];
  if (!Array.isArray(value)) {
    issues.push({ code: "SCHEMA_ERROR", path: `/${key}`, message: `${key} 必须是数组` });
    return [];
  }
  return value;
}

function collectIds(records: Record<string, unknown>[], path: string, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  records.forEach((record, index) => {
    if (typeof record.id !== "string") {
      issues.push({
        code: "SCHEMA_ERROR",
        path: `${path}/${index}/id`,
        message: "id 必须是字符串"
      });
    } else {
      ids.add(record.id);
    }
  });
  return ids;
}

function validateRefs(
  records: Record<string, unknown>[],
  path: string,
  sourceIds: Set<string>,
  issues: ValidationIssue[]
): void {
  records.forEach((record, recordIndex) => {
    const refs = record.sourceRefs;
    if (!Array.isArray(refs)) return;
    refs.forEach((ref, refIndex) => {
      if (!isRecord(ref) || typeof ref.sourceId !== "string" || !sourceIds.has(ref.sourceId)) {
        issues.push({
          code: "DANGLING_SOURCE_REF",
          path: `${path}/${recordIndex}/sourceRefs/${refIndex}/sourceId`,
          message: "详情来源引用不存在"
        });
      }
    });
  });
}

/** 校验浏览器首屏索引的必要结构和内部引用。 */
export function validateCrownlineIndex(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ code: "SCHEMA_ERROR", path: "/", message: "索引必须是对象" }]
    };
  }
  if (input.schemaVersion !== CROWNLINE_SCHEMA_VERSION) {
    issues.push({
      code: "SCHEMA_ERROR",
      path: "/schemaVersion",
      message: `只支持数据版本 ${CROWNLINE_SCHEMA_VERSION}`
    });
  }
  if (!hasChronologyPolicy(input.chronologyPolicy)) {
    issues.push({
      code: "SCHEMA_ERROR",
      path: "/chronologyPolicy",
      message: "纪年规则缺失或格式错误"
    });
  }
  const sections = requireRecordArray(input, "timelineSections", issues);
  const entities = requireRecordArray(input, "entities", issues);
  const regions = requireRecordArray(input, "regions", issues);
  const entityIds = collectIds(entities, "/entities", issues);
  collectIds(regions, "/regions", issues);
  requireField(entities, "/entities", "id", isNonEmptyString, issues);
  requireField(
    entities,
    "/entities",
    "entityKind",
    (value) => isEnumValue(value, ENTITY_KINDS),
    issues
  );
  requireField(entities, "/entities", "names", hasNames, issues);
  requireField(
    entities,
    "/entities",
    "existencePeriods",
    (value) => hasPeriods(value, true),
    issues
  );
  requireField(
    entities,
    "/entities",
    "polityForms",
    (value) => Array.isArray(value) && value.every((form) => isEnumValue(form, POLITY_FORMS)),
    issues
  );
  requireField(entities, "/entities", "chronologyNote", isOptionalString, issues);
  requireField(
    entities,
    "/entities",
    "alternativeChronologies",
    hasAlternativeChronologies,
    issues
  );
  requireField(entities, "/entities", "displayRangeOverride", isOptionalString, issues);
  requireField(
    entities,
    "/entities",
    "displayCategory",
    (value) => isEnumValue(value, DISPLAY_CATEGORIES),
    issues
  );
  requireField(entities, "/entities", "confidenceNote", isOptionalString, issues);
  requireField(
    entities,
    "/entities",
    "chronologyStatus",
    (value) => isEnumValue(value, CHRONOLOGY_STATUSES),
    issues
  );
  requireField(entities, "/entities", "historicalRegionIds", isStringArray, issues);
  requireField(entities, "/entities", "culturalSphereIds", isStringArray, issues);
  requireField(entities, "/entities", "modernAreaIds", isStringArray, issues);
  requireField(entities, "/entities", "description", (value) => typeof value === "string", issues);
  requireField(entities, "/entities", "sourceRefs", (value) => hasSourceRefs(value), issues);
  requireField(
    entities,
    "/entities",
    "confidence",
    (value) => isEnumValue(value, CONFIDENCE_LEVELS),
    issues
  );
  requireField(regions, "/regions", "id", isNonEmptyString, issues);
  requireField(regions, "/regions", "names", hasNames, issues);
  requireField(
    regions,
    "/regions",
    "regionKind",
    (value) => isEnumValue(value, REGION_KINDS),
    issues
  );
  requireField(regions, "/regions", "coverage", hasCoverage, issues);
  requireField(regions, "/regions", "parentRegionId", isOptionalString, issues);
  requireField(regions, "/regions", "description", (value) => typeof value === "string", issues);
  requireField(regions, "/regions", "sourceRefs", (value) => hasSourceRefs(value), issues);
  requireField(sections, "/timelineSections", "id", isNonEmptyString, issues);
  requireField(
    sections,
    "/timelineSections",
    "title",
    (value) => typeof value === "string",
    issues
  );
  requireField(sections, "/timelineSections", "displayRange", isNonEmptyString, issues);
  requireField(sections, "/timelineSections", "range", hasTimelineRange, issues);
  requireField(sections, "/timelineSections", "entityIds", isStringArray, issues);

  if (
    !Array.isArray(input.detailEntityIds) ||
    input.detailEntityIds.some((id) => typeof id !== "string")
  ) {
    issues.push({
      code: "SCHEMA_ERROR",
      path: "/detailEntityIds",
      message: "detailEntityIds 必须是字符串数组"
    });
  } else {
    input.detailEntityIds.forEach((id, index) => {
      if (!entityIds.has(id)) {
        issues.push({
          code: "DANGLING_ENTITY_REF",
          path: `/detailEntityIds/${index}`,
          message: `详情实体 ${id} 不存在`
        });
      }
    });
  }

  sections.forEach((section, sectionIndex) => {
    if (!Array.isArray(section.entityIds)) return;
    section.entityIds.forEach((entityId, entityIndex) => {
      if (typeof entityId !== "string" || !entityIds.has(entityId)) {
        issues.push({
          code: "DANGLING_ENTITY_REF",
          path: `/timelineSections/${sectionIndex}/entityIds/${entityIndex}`,
          message: `阶段实体 ${String(entityId)} 不存在`
        });
      }
    });
  });
  return { valid: issues.length === 0, issues };
}

/** 校验详情核心结构；关系与事件项目由领域层逐条隔离。 */
export function validateCrownlineDetail(
  input: unknown,
  expectedEntityId: string
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ code: "SCHEMA_ERROR", path: "/", message: "详情必须是对象" }]
    };
  }
  if (input.schemaVersion !== CROWNLINE_SCHEMA_VERSION) {
    issues.push({
      code: "SCHEMA_ERROR",
      path: "/schemaVersion",
      message: `只支持数据版本 ${CROWNLINE_SCHEMA_VERSION}`
    });
  }
  if (input.entityId !== expectedEntityId) {
    issues.push({
      code: "DETAIL_ENTITY_MISMATCH",
      path: "/entityId",
      message: `请求 ${expectedEntityId}，实际收到 ${String(input.entityId)}`
    });
  }

  const persons = requireRecordArray(input, "persons", issues);
  const reigns = requireRecordArray(input, "reigns", issues);
  const vacancies = requireRecordArray(input, "reignVacancies", issues);
  requireOpaqueArray(input, "relationships", issues);
  requireOpaqueArray(input, "events", issues);
  const sources = requireRecordArray(input, "sources", issues);
  const personIds = collectIds(persons, "/persons", issues);
  const sourceIds = collectIds(sources, "/sources", issues);
  requireField(persons, "/persons", "names", hasNames, issues);
  requireField(persons, "/persons", "description", (value) => typeof value === "string", issues);
  requireField(persons, "/persons", "sourceRefs", (value) => hasSourceRefs(value), issues);
  collectIds(reigns, "/reigns", issues);
  requireField(reigns, "/reigns", "personId", isNonEmptyString, issues);
  requireField(reigns, "/reigns", "polityId", isNonEmptyString, issues);
  requireField(reigns, "/reigns", "periods", (value) => hasPeriods(value, true), issues);
  requireField(reigns, "/reigns", "titles", isStringArray, issues);
  requireField(
    reigns,
    "/reigns",
    "localTitles",
    (value) => value === undefined || isStringArray(value),
    issues
  );
  requireField(reigns, "/reigns", "role", (value) => isEnumValue(value, REIGN_ROLES), issues);
  requireField(
    reigns,
    "/reigns",
    "chronologyStatus",
    (value) => isEnumValue(value, CHRONOLOGY_STATUSES),
    issues
  );
  requireField(reigns, "/reigns", "note", isOptionalString, issues);
  requireField(reigns, "/reigns", "sourceRefs", (value) => hasSourceRefs(value), issues);
  requireField(
    reigns,
    "/reigns",
    "confidence",
    (value) => isEnumValue(value, CONFIDENCE_LEVELS),
    issues
  );
  requireField(reigns, "/reigns", "confidenceNote", isOptionalString, issues);
  collectIds(vacancies, "/reignVacancies", issues);
  requireField(vacancies, "/reignVacancies", "polityId", isNonEmptyString, issues);
  requireField(vacancies, "/reignVacancies", "periods", (value) => hasPeriods(value, true), issues);
  requireField(vacancies, "/reignVacancies", "note", isNonEmptyString, issues);
  requireField(vacancies, "/reignVacancies", "sourceRefs", (value) => hasSourceRefs(value), issues);
  requireField(
    vacancies,
    "/reignVacancies",
    "confidence",
    (value) => isEnumValue(value, CONFIDENCE_LEVELS),
    issues
  );
  requireField(vacancies, "/reignVacancies", "confidenceNote", isOptionalString, issues);
  sources.forEach((source, index) => {
    if (!isValidSource(source)) {
      issues.push({
        code: "SCHEMA_ERROR",
        path: `/sources/${index}`,
        message: "来源缺少详情界面所需字段"
      });
    }
  });

  reigns.forEach((reign, index) => {
    if (typeof reign.personId !== "string" || !personIds.has(reign.personId)) {
      issues.push({
        code: "DANGLING_PERSON_REF",
        path: `/reigns/${index}/personId`,
        message: `任期人物 ${String(reign.personId)} 不存在`
      });
    }
    if (reign.polityId !== expectedEntityId) {
      issues.push({
        code: "DETAIL_ENTITY_MISMATCH",
        path: `/reigns/${index}/polityId`,
        message: "任期不属于当前详情实体"
      });
    }
  });
  vacancies.forEach((vacancy, index) => {
    if (vacancy.polityId !== expectedEntityId) {
      issues.push({
        code: "DETAIL_ENTITY_MISMATCH",
        path: `/reignVacancies/${index}/polityId`,
        message: "空位记录不属于当前详情实体"
      });
    }
  });
  validateRefs(persons, "/persons", sourceIds, issues);
  validateRefs(reigns, "/reigns", sourceIds, issues);
  validateRefs(vacancies, "/reignVacancies", sourceIds, issues);
  return { valid: issues.length === 0, issues };
}

export function asCrownlineIndex(input: unknown): CrownlineIndex {
  const result = validateCrownlineIndex(input);
  if (!result.valid) throw new Error(formatRuntimeIssues("首屏索引校验失败", result));
  return input as CrownlineIndex;
}

export function asCrownlineDetail(input: unknown, entityId: string): CrownlineDetail {
  const result = validateCrownlineDetail(input, entityId);
  if (!result.valid) throw new Error(formatRuntimeIssues("详情数据校验失败", result));
  return input as CrownlineDetail;
}

/** 严格校验地理根对象，并逐条隔离无法安全使用的地理快照。 */
export function asCrownlineGeography(input: unknown): GeographyLoadResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    throw new Error(
      formatRuntimeIssues("地理数据校验失败", {
        valid: false,
        issues: [{ code: "SCHEMA_ERROR", path: "/", message: "地理数据必须是对象" }]
      })
    );
  }
  if (input.schemaVersion !== CROWNLINE_SCHEMA_VERSION) {
    issues.push({
      code: "SCHEMA_ERROR",
      path: "/schemaVersion",
      message: `只支持数据版本 ${CROWNLINE_SCHEMA_VERSION}`
    });
  }
  if (!Array.isArray(input.geographicSnapshots)) {
    issues.push({
      code: "SCHEMA_ERROR",
      path: "/geographicSnapshots",
      message: "geographicSnapshots 必须是数组"
    });
  }
  const sources = requireRecordArray(input, "sources", issues);
  const sourceIds = new Set<string>();
  sources.forEach((source, index) => {
    if (!isValidSource(source) || (typeof source.id === "string" && sourceIds.has(source.id))) {
      issues.push({
        code: "SCHEMA_ERROR",
        path: `/sources/${index}`,
        message: "来源缺少必需字段或 ID 重复"
      });
      return;
    }
    sourceIds.add(source.id as string);
  });
  if (issues.length > 0) {
    throw new Error(formatRuntimeIssues("地理数据校验失败", { valid: false, issues }));
  }

  const snapshots = input.geographicSnapshots as unknown[];
  const validSnapshots = snapshots.filter((snapshot) => {
    return isValidGeographicSnapshot(snapshot, sourceIds);
  });
  return {
    geography: {
      schemaVersion: CROWNLINE_SCHEMA_VERSION,
      geographicSnapshots: validSnapshots,
      sources: sources as unknown as Source[]
    },
    omittedCount: snapshots.length - validSnapshots.length
  };
}

function formatRuntimeIssues(label: string, result: ValidationResult): string {
  const details = result.issues
    .map((issue) => `[${issue.code}] ${issue.path} ${issue.message}`)
    .join("\n");
  return `${label}：\n${details}`;
}
