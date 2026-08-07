import type { ValidationIssue, ValidationResult } from "../domain/dataValidation";
import type { CrownlineDetail, CrownlineIndex } from "../domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasNames(value: unknown): boolean {
  return isRecord(value) && typeof value.primary === "string" && isStringArray(value.aliases);
}

function hasPeriods(value: unknown): boolean {
  return Array.isArray(value) && value.every((period) => {
    return isRecord(period) && isRecord(period.start) && isRecord(period.end) &&
      typeof period.start.year === "number" && typeof period.end.year === "number";
  });
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

function collectIds(records: Record<string, unknown>[], path: string, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  records.forEach((record, index) => {
    if (typeof record.id !== "string") {
      issues.push({ code: "SCHEMA_ERROR", path: `${path}/${index}/id`, message: "id 必须是字符串" });
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
    return { valid: false, issues: [{ code: "SCHEMA_ERROR", path: "/", message: "索引必须是对象" }] };
  }
  if (input.schemaVersion !== 3) {
    issues.push({ code: "SCHEMA_ERROR", path: "/schemaVersion", message: "只支持数据版本 3" });
  }
  if (!isRecord(input.chronologyPolicy)) {
    issues.push({ code: "SCHEMA_ERROR", path: "/chronologyPolicy", message: "缺少纪年规则" });
  }
  const sections = requireRecordArray(input, "timelineSections", issues);
  const entities = requireRecordArray(input, "entities", issues);
  const regions = requireRecordArray(input, "regions", issues);
  const entityIds = collectIds(entities, "/entities", issues);
  collectIds(regions, "/regions", issues);
  requireField(entities, "/entities", "names", hasNames, issues);
  requireField(entities, "/entities", "existencePeriods", hasPeriods, issues);
  requireField(entities, "/entities", "polityForms", Array.isArray, issues);
  requireField(entities, "/entities", "historicalRegionIds", isStringArray, issues);
  requireField(entities, "/entities", "description", (value) => typeof value === "string", issues);
  requireField(regions, "/regions", "names", hasNames, issues);
  requireField(regions, "/regions", "coverage", isRecord, issues);
  requireField(sections, "/timelineSections", "title", (value) => typeof value === "string", issues);
  requireField(sections, "/timelineSections", "range", isRecord, issues);

  if (!Array.isArray(input.detailEntityIds) || input.detailEntityIds.some((id) => typeof id !== "string")) {
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

/** 校验单个详情包与请求实体一致，并且人物、事件和来源引用闭合。 */
export function validateCrownlineDetail(
  input: unknown,
  expectedEntityId: string
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { valid: false, issues: [{ code: "SCHEMA_ERROR", path: "/", message: "详情必须是对象" }] };
  }
  if (input.schemaVersion !== 3) {
    issues.push({ code: "SCHEMA_ERROR", path: "/schemaVersion", message: "只支持数据版本 3" });
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
  const relationships = requireRecordArray(input, "relationships", issues);
  const events = requireRecordArray(input, "events", issues);
  const sources = requireRecordArray(input, "sources", issues);
  const personIds = collectIds(persons, "/persons", issues);
  const eventIds = collectIds(events, "/events", issues);
  const sourceIds = collectIds(sources, "/sources", issues);
  requireField(persons, "/persons", "names", hasNames, issues);
  requireField(persons, "/persons", "description", (value) => typeof value === "string", issues);
  requireField(reigns, "/reigns", "periods", hasPeriods, issues);
  requireField(reigns, "/reigns", "titles", isStringArray, issues);
  requireField(vacancies, "/reignVacancies", "periods", hasPeriods, issues);
  requireField(sources, "/sources", "citation", (value) => typeof value === "string", issues);

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
  relationships.forEach((relationship, relationshipIndex) => {
    if (Array.isArray(relationship.eventIds)) {
      relationship.eventIds.forEach((eventId, eventIndex) => {
        if (typeof eventId !== "string" || !eventIds.has(eventId)) {
          issues.push({
            code: "DANGLING_EVENT_REF",
            path: `/relationships/${relationshipIndex}/eventIds/${eventIndex}`,
            message: `关系事件 ${String(eventId)} 不存在`
          });
        }
      });
    }
  });
  validateRefs(persons, "/persons", sourceIds, issues);
  validateRefs(reigns, "/reigns", sourceIds, issues);
  validateRefs(vacancies, "/reignVacancies", sourceIds, issues);
  validateRefs(relationships, "/relationships", sourceIds, issues);
  validateRefs(events, "/events", sourceIds, issues);
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

function formatRuntimeIssues(label: string, result: ValidationResult): string {
  const details = result.issues
    .map((issue) => `[${issue.code}] ${issue.path} ${issue.message}`)
    .join("\n");
  return `${label}：\n${details}`;
}
