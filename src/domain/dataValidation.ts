import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";

import schema from "../data/crownline-data.schema.json";
import { validateBoundaryGeometry } from "./boundarySnapshots";
import { toOrdinal } from "./chronology";
import { isValidLanguageTag } from "./entityNames";
import type {
  ConfidenceLevel,
  CrownlineData,
  HistoricalInterval,
  LocalizedNames,
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

/** 判断两组历史区间是否至少存在一个共同年份。 */
function periodsOverlap(
  leftPeriods: HistoricalInterval[],
  rightPeriods: HistoricalInterval[]
): boolean {
  return leftPeriods.some((left) => {
    return rightPeriods.some((right) => {
      return (
        toOrdinal(left.start.year) <= toOrdinal(right.end.year) &&
        toOrdinal(left.end.year) >= toOrdinal(right.start.year)
      );
    });
  });
}

/** 判断一个业务区间是否完整落在某一个存在分段中。 */
function periodIsContained(
  period: HistoricalInterval,
  containerPeriods: HistoricalInterval[]
): boolean {
  return containerPeriods.some((container) => {
    return (
      toOrdinal(period.start.year) >= toOrdinal(container.start.year) &&
      toOrdinal(period.end.year) <= toOrdinal(container.end.year)
    );
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

/** 本地名称存在时，语言标签必须能安全写入 HTML lang。 */
function validateLocalizedNames(
  names: LocalizedNames,
  path: string,
  issues: ValidationIssue[]
): void {
  if (names.local && !isValidLanguageTag(names.localLanguageTag)) {
    issues.push({
      code: "INVALID_LANGUAGE_TAG",
      path: `${path}/localLanguageTag`,
      message: "本地名称必须使用有效的 BCP 47 语言标签"
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
  const entityById = new Map(data.entities.map((entity) => [entity.id, entity]));
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
    ...data.reignVacancies,
    ...data.relationships,
    ...data.events,
    ...data.geographicSnapshots,
    ...data.boundarySnapshots,
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
    validateLocalizedNames(entity.names, `${path}/names`, issues);
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
      validateSourceRefs(
        alternative.sourceRefs,
        `${alternativePath}/sourceRefs`,
        sourceIds,
        issues
      );
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
    validateConfidenceNote(
      entity.confidence,
      entity.confidenceNote,
      `${path}/confidenceNote`,
      issues
    );
  });

  data.regions.forEach((region, regionIndex) => {
    const path = `/regions/${regionIndex}`;
    validateLocalizedNames(region.names, `${path}/names`, issues);
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
    validateLocalizedNames(person.names, `/persons/${personIndex}/names`, issues);
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
    const polity = entityById.get(reign.polityId);
    if (!polity) {
      issues.push({
        code: "DANGLING_ENTITY_REF",
        path: `${path}/polityId`,
        message: `政权 ${reign.polityId} 不存在`
      });
    } else if (polity.entityKind !== "polity") {
      issues.push({
        code: "INVALID_REIGN_POLITY",
        path: `${path}/polityId`,
        message: `任期只能引用政权，${reign.polityId} 是历史分期`
      });
    } else {
      reign.periods.forEach((period, periodIndex) => {
        // 区间必须完整落在同一个存在分段中，不能跨越唐、复立政权等中断期。
        const contained = periodIsContained(period, polity.existencePeriods);
        if (!contained) {
          issues.push({
            code: "REIGN_OUTSIDE_POLITY",
            path: `${path}/periods/${periodIndex}`,
            message: `任期区间必须完整落在政权 ${reign.polityId} 的存在区间内`
          });
        }
      });
    }
    validatePeriods(reign.periods, `${path}/periods`, issues);
    validateSourceRefs(reign.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(
      reign.confidence,
      reign.confidenceNote,
      `${path}/confidenceNote`,
      issues
    );
  });

  data.reignVacancies.forEach((vacancy, vacancyIndex) => {
    const path = `/reignVacancies/${vacancyIndex}`;
    const polity = entityById.get(vacancy.polityId);
    if (!polity) {
      issues.push({
        code: "DANGLING_ENTITY_REF",
        path: `${path}/polityId`,
        message: `政权 ${vacancy.polityId} 不存在`
      });
    } else if (polity.entityKind !== "polity") {
      issues.push({
        code: "INVALID_VACANCY_POLITY",
        path: `${path}/polityId`,
        message: `空位记录只能引用政权，${vacancy.polityId} 是历史分期`
      });
    } else {
      vacancy.periods.forEach((period, periodIndex) => {
        const contained = periodIsContained(period, polity.existencePeriods);
        if (!contained) {
          issues.push({
            code: "VACANCY_OUTSIDE_POLITY",
            path: `${path}/periods/${periodIndex}`,
            message: `空位区间必须完整落在政权 ${vacancy.polityId} 的存在区间内`
          });
        }

        data.reigns
          .filter(({ polityId }) => polityId === vacancy.polityId)
          .flatMap((reign) => reign.periods)
          .forEach((reignPeriod) => {
            const overlaps =
              toOrdinal(period.start.year) <= toOrdinal(reignPeriod.end.year) &&
              toOrdinal(period.end.year) >= toOrdinal(reignPeriod.start.year);
            if (overlaps) {
              issues.push({
                code: "VACANCY_REIGN_OVERLAP",
                path: `${path}/periods/${periodIndex}`,
                message: "明确空位不能与同一政权的统治任期重叠"
              });
            }
          });

        data.reignVacancies
          .slice(0, vacancyIndex)
          .filter(({ polityId }) => polityId === vacancy.polityId)
          .flatMap((record) => record.periods)
          .forEach((previousPeriod) => {
            const overlaps =
              toOrdinal(period.start.year) <= toOrdinal(previousPeriod.end.year) &&
              toOrdinal(period.end.year) >= toOrdinal(previousPeriod.start.year);
            if (overlaps) {
              issues.push({
                code: "OVERLAPPING_VACANCIES",
                path: `${path}/periods/${periodIndex}`,
                message: "同一政权的明确空位记录不得互相重叠"
              });
            }
          });
      });
    }
    validatePeriods(vacancy.periods, `${path}/periods`, issues);
    validateSourceRefs(vacancy.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(
      vacancy.confidence,
      vacancy.confidenceNote,
      `${path}/confidenceNote`,
      issues
    );
  });

  data.relationships.forEach((relationship, relationshipIndex) => {
    const path = `/relationships/${relationshipIndex}`;
    const participants = new Set<string>();
    relationship.participants.forEach((participant, participantIndex) => {
      const entity = entityById.get(participant.entityId);
      if (!entity) {
        issues.push({
          code: "DANGLING_ENTITY_REF",
          path: `${path}/participants/${participantIndex}/entityId`,
          message: `实体 ${participant.entityId} 不存在`
        });
      } else if (!periodsOverlap(relationship.periods, entity.existencePeriods)) {
        issues.push({
          code: "RELATIONSHIP_OUTSIDE_PARTICIPANT_EXISTENCE",
          path: `${path}/participants/${participantIndex}/entityId`,
          message: `关系区间与参与实体 ${participant.entityId} 的存续期完全错位`
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
      const entity = entityById.get(entityId);
      if (!entity) {
        issues.push({
          code: "DANGLING_ENTITY_REF",
          path: `${path}/participantEntityIds/${participantIndex}`,
          message: `实体 ${entityId} 不存在`
        });
      } else if (!periodsOverlap(event.periods, entity.existencePeriods)) {
        issues.push({
          code: "EVENT_OUTSIDE_PARTICIPANT_EXISTENCE",
          path: `${path}/participantEntityIds/${participantIndex}`,
          message: `事件区间与参与实体 ${entityId} 的存续期完全错位`
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
    validateConfidenceNote(
      event.confidence,
      event.confidenceNote,
      `${path}/confidenceNote`,
      issues
    );
  });

  const geographicKeys = new Set<string>();
  data.geographicSnapshots.forEach((snapshot, snapshotIndex) => {
    const path = `/geographicSnapshots/${snapshotIndex}`;
    const polity = entityById.get(snapshot.polityId);
    if (!polity) {
      issues.push({
        code: "DANGLING_ENTITY_REF",
        path: `${path}/polityId`,
        message: `政权 ${snapshot.polityId} 不存在`
      });
    } else if (polity.entityKind !== "polity") {
      issues.push({
        code: "INVALID_GEOGRAPHIC_POLITY",
        path: `${path}/polityId`,
        message: `地理快照只能引用政权，${snapshot.polityId} 是历史分期`
      });
    } else {
      snapshot.periods.forEach((period, periodIndex) => {
        if (!periodIsContained(period, polity.existencePeriods)) {
          issues.push({
            code: "GEOGRAPHY_OUTSIDE_POLITY",
            path: `${path}/periods/${periodIndex}`,
            message: `地理快照必须完整落在政权 ${snapshot.polityId} 的存在区间内`
          });
        }
      });
    }

    if (!snapshot.positionNote.trim()) {
      issues.push({
        code: "EMPTY_POSITION_NOTE",
        path: `${path}/positionNote`,
        message: "地理快照必须说明坐标口径或示意限制"
      });
    }

    const geographicKey = JSON.stringify([
      snapshot.polityId,
      snapshot.placeName,
      snapshot.role,
      snapshot.periods.map(({ start, end }) => [start.year, end.year])
    ]);
    if (geographicKeys.has(geographicKey)) {
      issues.push({
        code: "DUPLICATE_GEOGRAPHIC_SNAPSHOT",
        path,
        message: "同一政权、地点、角色和适用区间的地理快照重复"
      });
    }
    geographicKeys.add(geographicKey);

    validatePeriods(snapshot.periods, `${path}/periods`, issues);
    validateSourceRefs(snapshot.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(
      snapshot.confidence,
      snapshot.confidenceNote,
      `${path}/confidenceNote`,
      issues
    );
  });

  const boundaryKeys = new Set<string>();
  const boundaryGeometryKeys = new Set<string>();
  const boundarySnapshotsByPolity = new Map<string, typeof data.boundarySnapshots>();
  data.boundarySnapshots.forEach((snapshot, snapshotIndex) => {
    const path = `/boundarySnapshots/${snapshotIndex}`;
    const polity = entityById.get(snapshot.polityId);
    if (!polity) {
      issues.push({
        code: "DANGLING_ENTITY_REF",
        path: `${path}/polityId`,
        message: `政权 ${snapshot.polityId} 不存在`
      });
    } else if (polity.entityKind !== "polity") {
      issues.push({
        code: "INVALID_BOUNDARY_POLITY",
        path: `${path}/polityId`,
        message: `疆域快照只能引用政权，${snapshot.polityId} 是历史分期`
      });
    } else {
      snapshot.periods.forEach((period, periodIndex) => {
        if (!periodIsContained(period, polity.existencePeriods)) {
          issues.push({
            code: "BOUNDARY_OUTSIDE_POLITY",
            path: `${path}/periods/${periodIndex}`,
            message: `疆域快照必须完整落在政权 ${snapshot.polityId} 的存在区间内`
          });
        }
      });
    }

    validatePeriods(snapshot.periods, `${path}/periods`, issues);
    validateSourceRefs(snapshot.sourceRefs, `${path}/sourceRefs`, sourceIds, issues);
    validateConfidenceNote(
      snapshot.confidence,
      snapshot.confidenceNote,
      `${path}/confidenceNote`,
      issues
    );
    if (!snapshot.boundaryNote.trim()) {
      issues.push({
        code: "EMPTY_BOUNDARY_NOTE",
        path: `${path}/boundaryNote`,
        message: "疆域快照必须说明历史口径与示意限制"
      });
    }
    const provenance = snapshot.provenance;
    if (
      !provenance.datasetTitle.trim() ||
      !provenance.attribution.trim() ||
      !provenance.licenseName.trim() ||
      !provenance.licenseUrl.trim() ||
      !provenance.sourceUrl.trim() ||
      !provenance.processingNote.trim()
    ) {
      issues.push({
        code: "INCOMPLETE_BOUNDARY_PROVENANCE",
        path: `${path}/provenance`,
        message: "疆域来源必须包含数据集、署名、许可地址、来源地址和处理说明"
      });
    }
    validateBoundaryGeometry(snapshot.geometry, `${path}/geometry`).forEach((issue) => {
      issues.push(issue);
    });

    const timeKey = JSON.stringify([
      snapshot.polityId,
      snapshot.periods.map(({ start, end }) => [start.year, end.year])
    ]);
    if (boundaryKeys.has(timeKey)) {
      issues.push({
        code: "DUPLICATE_BOUNDARY_INTERVAL",
        path,
        message: "同一政权的疆域适用区间重复"
      });
    }
    boundaryKeys.add(timeKey);
    const geometryKey = JSON.stringify([snapshot.polityId, snapshot.periods, snapshot.geometry]);
    if (boundaryGeometryKeys.has(geometryKey)) {
      issues.push({
        code: "DUPLICATE_BOUNDARY_GEOMETRY",
        path,
        message: "同一政权、同一时间范围和完全相同几何的疆域快照重复"
      });
    }
    boundaryGeometryKeys.add(geometryKey);

    const politySnapshots = boundarySnapshotsByPolity.get(snapshot.polityId) ?? [];
    politySnapshots.forEach((previous) => {
      if (periodsOverlap(previous.periods, snapshot.periods)) {
        issues.push({
          code: "OVERLAPPING_BOUNDARY_SNAPSHOTS",
          path: `${path}/periods`,
          message: `政权 ${snapshot.polityId} 的采用疆域快照与 ${previous.id} 的适用时间重叠`
        });
      }
    });
    politySnapshots.push(snapshot);
    boundarySnapshotsByPolity.set(snapshot.polityId, politySnapshots);
  });

  return { valid: issues.length === 0, issues };
}
