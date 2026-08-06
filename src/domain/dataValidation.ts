import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";

import schema from "../data/crownline-data.schema.json";
import { toOrdinal } from "./chronology";
import type {
  ConfidenceLevel,
  CrownlineData,
  HistoricalInterval,
  SourceRef
} from "./types";

/** 单条可定位、可机器识别的数据契约问题。 */
export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

/** 完整数据校验的汇总结果。 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile<CrownlineData>(schema);

/** 将 Ajv 错误转换为项目统一的问题格式。 */
function schemaIssue(error: ErrorObject): ValidationIssue {
  const missingProperty =
    error.keyword === "required" && "missingProperty" in error.params
      ? `/${String(error.params.missingProperty)}`
      : "";
  return {
    code: "SCHEMA_ERROR",
    path: `${error.instancePath}${missingProperty}` || "/",
    message: error.message ?? "不符合 JSON Schema"
  };
}

/** 校验历史区间的方向、顺序、重叠和可无损合并情况。 */
function validatePeriods(
  periods: HistoricalInterval[],
  path: string,
  issues: ValidationIssue[]
): void {
  periods.forEach((period, index) => {
    const start = toOrdinal(period.start.year);
    const end = toOrdinal(period.end.year);
    if (start > end) {
      issues.push({
        code: "INVALID_INTERVAL",
        path: `${path}/${index}`,
        message: "区间起点不得晚于终点"
      });
    }

    const previous = periods[index - 1];
    if (!previous) return;
    const previousEnd = toOrdinal(previous.end.year);
    if (start <= previousEnd) {
      issues.push({
        code: "OVERLAPPING_INTERVALS",
        path: `${path}/${index}`,
        message: "区间必须按时间排序且不得重叠"
      });
    } else if (start === previousEnd + 1) {
      issues.push({
        code: "ADJACENT_INTERVALS",
        path: `${path}/${index}`,
        message: "相邻区间可以无损合并"
      });
    }
  });
}

/** 检查业务记录引用的来源是否存在。 */
function validateSourceRefs(
  refs: SourceRef[],
  path: string,
  sourceIds: Set<string>,
  issues: ValidationIssue[]
): void {
  refs.forEach((ref, index) => {
    if (!sourceIds.has(ref.sourceId)) {
      issues.push({
        code: "DANGLING_SOURCE_REF",
        path: `${path}/${index}/sourceId`,
        message: `来源 ${ref.sourceId} 不存在`
      });
    }
  });
}

/** 低可信度或争议记录必须向使用者解释不确定性。 */
function validateConfidenceNote(
  confidence: ConfidenceLevel,
  note: string | undefined,
  path: string,
  issues: ValidationIssue[]
): void {
  if ((confidence === "low" || confidence === "disputed") && !note) {
    issues.push({
      code: "MISSING_CONFIDENCE_NOTE",
      path,
      message: `${confidence} 可信度必须附说明`
    });
  }
}

/**
 * 执行 Crownline 数据契约的完整校验。
 * 第一层由 JSON Schema 检查结构，第二层检查跨记录引用和业务语义。
 */
export function validateCrownlineData(input: unknown): ValidationResult {
  if (!validateSchema(input)) {
    return {
      valid: false,
      issues: (validateSchema.errors ?? []).map(schemaIssue)
    };
  }

  const data = input;
  const issues: ValidationIssue[] = [];
  const entityIds = new Set(data.entities.map(({ id }) => id));
  const regionIds = new Set(data.regions.map(({ id }) => id));
  const regionById = new Map(data.regions.map((region) => [region.id, region]));
  const personIds = new Set(data.persons.map(({ id }) => id));
  const eventIds = new Set(data.events.map(({ id }) => id));
  const sourceIds = new Set(data.sources.map(({ id }) => id));

  // 所有顶层记录共享同一个 ID 命名空间，避免跨类型引用产生歧义。
  const records = [
    ...data.timelineSections,
    ...data.entities,
    ...data.regions,
    ...data.persons,
    ...data.reigns,
    ...data.relationships,
    ...data.events,
    ...data.sources
  ];
  const firstPathById = new Map<string, string>();
  records.forEach((record) => {
    const previousPath = firstPathById.get(record.id);
    if (previousPath) {
      issues.push({
        code: "DUPLICATE_ID",
        path: `id:${record.id}`,
        message: `ID ${record.id} 已用于 ${previousPath}`
      });
    } else {
      firstPathById.set(record.id, record.id);
    }
  });

  // 分阶段执行语义校验，使问题路径与原始 JSON 数组位置保持一致。
  data.timelineSections.forEach((section, sectionIndex) => {
    const path = `/timelineSections/${sectionIndex}`;
    if (toOrdinal(section.range.startYear) > toOrdinal(section.range.endYear)) {
      issues.push({
        code: "INVALID_INTERVAL",
        path: `${path}/range`,
        message: "阶段起点不得晚于终点"
      });
    }
    section.entityIds.forEach((entityId, entityIndex) => {
      if (!entityIds.has(entityId)) {
        issues.push({
          code: "DANGLING_ENTITY_REF",
          path: `${path}/entityIds/${entityIndex}`,
          message: `实体 ${entityId} 不存在`
        });
      }
    });
  });

  data.entities.forEach((entity, entityIndex) => {
    const path = `/entities/${entityIndex}`;
    validatePeriods(entity.existencePeriods, `${path}/existencePeriods`, issues);
    if (
      (entity.entityKind === "historical-period" && entity.polityForms.length > 0) ||
      (entity.entityKind === "polity" && entity.polityForms.length === 0)
    ) {
      issues.push({
        code: "INVALID_ENTITY_CLASSIFICATION",
        path: `${path}/polityForms`,
        message: "政权必须有形态，历史分期不得有政权形态"
      });
    }
    if (entity.chronologyStatus === "disputed" && !entity.chronologyNote) {
      issues.push({
        code: "MISSING_CHRONOLOGY_NOTE",
        path: `${path}/chronologyNote`,
        message: "争议年代必须说明采用口径"
      });
    }
    entity.alternativeChronologies?.forEach((alternative, alternativeIndex) => {
      const alternativePath = `${path}/alternativeChronologies/${alternativeIndex}`;
      validatePeriods(alternative.existencePeriods, `${alternativePath}/existencePeriods`, issues);
      validateSourceRefs(alternative.sourceRefs, `${alternativePath}/sourceRefs`, sourceIds, issues);
    });

    const regionReferenceGroups = [
      ["historicalRegionIds", entity.historicalRegionIds, "historical-region"],
      ["culturalSphereIds", entity.culturalSphereIds, "cultural-sphere"],
      ["modernAreaIds", entity.modernAreaIds, "modern-area"]
    ] as const;
    regionReferenceGroups.forEach(([field, referencedRegionIds, expectedKind]) => {
      referencedRegionIds.forEach((regionId, regionIndex) => {
        const region = regionById.get(regionId);
        if (!region) {
          issues.push({
            code: "DANGLING_REGION_REF",
            path: `${path}/${field}/${regionIndex}`,
            message: `地区 ${regionId} 不存在`
          });
        } else if (region.regionKind !== expectedKind) {
          issues.push({
            code: "INVALID_REGION_REFERENCE_KIND",
            path: `${path}/${field}/${regionIndex}`,
            message: `${field} 只能引用 ${expectedKind}`
          });
        }
      });
    });
    validateSourceRefs(entity.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(entity.confidence, entity.confidenceNote, `${path}/confidenceNote`, issues);
  });

  data.regions.forEach((region, regionIndex) => {
    const path = `/regions/${regionIndex}`;
    validateSourceRefs(region.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    if (!region.parentRegionId) return;
    const parent = regionById.get(region.parentRegionId);
    if (!parent) {
      issues.push({
        code: "DANGLING_REGION_PARENT_REF",
        path: `${path}/parentRegionId`,
        message: `父地区 ${region.parentRegionId} 不存在`
      });
    } else if (parent.regionKind !== region.regionKind) {
      issues.push({
        code: "INVALID_REGION_PARENT_KIND",
        path: `${path}/parentRegionId`,
        message: "父子地区必须属于同一种地区类型"
      });
    }
  });

  data.regions.forEach((region, regionIndex) => {
    const visited = new Set<string>();
    let current = region;
    while (current.parentRegionId) {
      if (visited.has(current.id)) {
        issues.push({
          code: "CYCLIC_REGION_PARENT",
          path: `/regions/${regionIndex}/parentRegionId`,
          message: `地区 ${region.id} 的父子关系形成循环`
        });
        break;
      }
      visited.add(current.id);
      const parent = regionById.get(current.parentRegionId);
      if (!parent) break;
      current = parent;
    }
  });

  data.persons.forEach((person, personIndex) => {
    validateSourceRefs(person.sourceRefs, `/persons/${personIndex}/sourceRefs`, sourceIds, issues);
  });

  data.reigns.forEach((reign, reignIndex) => {
    const path = `/reigns/${reignIndex}`;
    if (!personIds.has(reign.personId)) {
      issues.push({
        code: "DANGLING_PERSON_REF",
        path: `${path}/personId`,
        message: `人物 ${reign.personId} 不存在`
      });
    }
    if (!entityIds.has(reign.polityId)) {
      issues.push({
        code: "DANGLING_ENTITY_REF",
        path: `${path}/polityId`,
        message: `政权 ${reign.polityId} 不存在`
      });
    }
    validatePeriods(reign.periods, `${path}/periods`, issues);
    validateSourceRefs(reign.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(reign.confidence, reign.confidenceNote, `${path}/confidenceNote`, issues);
  });

  data.relationships.forEach((relationship, relationshipIndex) => {
    const path = `/relationships/${relationshipIndex}`;
    const participants = new Set<string>();
    relationship.participants.forEach((participant, participantIndex) => {
      if (!entityIds.has(participant.entityId)) {
        issues.push({
          code: "DANGLING_ENTITY_REF",
          path: `${path}/participants/${participantIndex}/entityId`,
          message: `实体 ${participant.entityId} 不存在`
        });
      }
      if (participants.has(participant.entityId)) {
        issues.push({
          code: "DUPLICATE_RELATIONSHIP_PARTICIPANT",
          path: `${path}/participants/${participantIndex}/entityId`,
          message: `关系参与方 ${participant.entityId} 重复`
        });
      }
      participants.add(participant.entityId);
    });
    relationship.eventIds.forEach((eventId, eventIndex) => {
      if (!eventIds.has(eventId)) {
        issues.push({
          code: "DANGLING_EVENT_REF",
          path: `${path}/eventIds/${eventIndex}`,
          message: `事件 ${eventId} 不存在`
        });
      }
    });
    validatePeriods(relationship.periods, `${path}/periods`, issues);
    validateSourceRefs(relationship.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(
      relationship.confidence,
      relationship.confidenceNote,
      `${path}/confidenceNote`,
      issues
    );
  });

  data.events.forEach((event, eventIndex) => {
    const path = `/events/${eventIndex}`;
    event.participantEntityIds.forEach((entityId, participantIndex) => {
      if (!entityIds.has(entityId)) {
        issues.push({
          code: "DANGLING_ENTITY_REF",
          path: `${path}/participantEntityIds/${participantIndex}`,
          message: `实体 ${entityId} 不存在`
        });
      }
    });
    event.regionIds.forEach((regionId, regionIndex) => {
      if (!regionIds.has(regionId)) {
        issues.push({
          code: "DANGLING_REGION_REF",
          path: `${path}/regionIds/${regionIndex}`,
          message: `地区 ${regionId} 不存在`
        });
      }
    });
    validatePeriods(event.periods, `${path}/periods`, issues);
    validateSourceRefs(event.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(event.confidence, event.confidenceNote, `${path}/confidenceNote`, issues);
  });

  return { valid: issues.length === 0, issues };
}
