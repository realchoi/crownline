import type {
  ConfidenceLevel,
  CrownlineDetail,
  EventType,
  HistoricalDate,
  HistoricalEvent,
  HistoricalInterval,
  Relationship,
  RelationshipParticipant,
  RelationshipType,
  Source,
  SourceRef
} from "./types";

export const RELATIONSHIP_TYPE_LABELS = {
  war: "战争",
  alliance: "联盟",
  diplomacy: "外交",
  tribute: "朝贡",
  vassalage: "臣属",
  trade: "贸易",
  "cultural-exchange": "文化交流"
} satisfies Record<RelationshipType, string>;

export const CONFIDENCE_LABELS = {
  high: "高可信度",
  medium: "中等可信度",
  low: "低可信度",
  disputed: "存在争议"
} satisfies Record<ConfidenceLevel, string>;

const TYPE_ORDER = Object.keys(RELATIONSHIP_TYPE_LABELS) as RelationshipType[];
const DATE_PRECISIONS = new Set(["exact", "circa", "decade", "century", "unknown"]);
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low", "disputed"]);
const EVENT_TYPES = new Set(["foundation", "dissolution", "succession", "battle", "treaty", "diplomatic", "other"]);

export interface ResolvedRelationshipSource {
  ref: SourceRef;
  source: Source;
}

export interface ResolvedHistoricalRelationship {
  relationship: Relationship;
  events: HistoricalEvent[];
  sources: ResolvedRelationshipSource[];
}

export interface HistoricalRelationshipGroup {
  type: RelationshipType;
  label: string;
  relationships: ResolvedHistoricalRelationship[];
}

export interface HistoricalRelationshipSelection {
  groups: HistoricalRelationshipGroup[];
  omittedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUniqueStrings(value: unknown, minimum = 0): value is string[] {
  return Array.isArray(value) && value.length >= minimum &&
    value.every(isNonEmptyString) && new Set(value).size === value.length;
}

function parseDate(value: unknown): HistoricalDate | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.year) || value.year === 0 ||
      !DATE_PRECISIONS.has(String(value.precision))) return null;
  return value as unknown as HistoricalDate;
}

function parsePeriods(value: unknown): HistoricalInterval[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const periods: HistoricalInterval[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const start = parseDate(candidate.start);
    const end = parseDate(candidate.end);
    if (!start || !end || start.year > end.year) return null;
    periods.push({ start, end });
  }
  return periods;
}

function parseSourceRefs(value: unknown): SourceRef[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const refs: SourceRef[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || !isNonEmptyString(candidate.sourceId) ||
        (candidate.locator !== undefined && !isNonEmptyString(candidate.locator)) ||
        (candidate.note !== undefined && !isNonEmptyString(candidate.note))) return null;
    refs.push(candidate as unknown as SourceRef);
  }
  return refs;
}

function parseConfidence(record: Record<string, unknown>): ConfidenceLevel | null {
  if (!CONFIDENCE_LEVELS.has(String(record.confidence))) return null;
  const confidence = record.confidence as ConfidenceLevel;
  if ((confidence === "low" || confidence === "disputed") &&
      !isNonEmptyString(record.confidenceNote)) return null;
  if (record.confidenceNote !== undefined && !isNonEmptyString(record.confidenceNote)) return null;
  return confidence;
}

function parseParticipants(value: unknown): RelationshipParticipant[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const participants: RelationshipParticipant[] = [];
  const entityIds = new Set<string>();
  for (const candidate of value) {
    if (!isRecord(candidate) || !isNonEmptyString(candidate.entityId) ||
        !isNonEmptyString(candidate.role) || entityIds.has(candidate.entityId)) return null;
    entityIds.add(candidate.entityId);
    participants.push(candidate as unknown as RelationshipParticipant);
  }
  return participants;
}

function parseEvent(value: unknown, sourceById: Map<string, Source>): HistoricalEvent | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) ||
      !EVENT_TYPES.has(String(value.type)) || !isNonEmptyString(value.title) ||
      !isNonEmptyString(value.summary) || !parsePeriods(value.periods) ||
      !hasUniqueStrings(value.participantEntityIds, 1) || !hasUniqueStrings(value.regionIds)) {
    return null;
  }
  const refs = parseSourceRefs(value.sourceRefs);
  if (!refs || refs.some(({ sourceId }) => !sourceById.has(sourceId)) || !parseConfidence(value)) {
    return null;
  }
  return value as unknown as HistoricalEvent;
}

function rawHasPair(value: unknown, leftEntityId: string, rightEntityId: string): boolean | null {
  if (!isRecord(value) || !Array.isArray(value.participants)) return null;
  const ids = value.participants.flatMap((candidate) => {
    return isRecord(candidate) && isNonEmptyString(candidate.entityId) ? [candidate.entityId] : [];
  });
  return ids.includes(leftEntityId) && ids.includes(rightEntityId);
}

function groupById(values: unknown[]): { anonymous: number; groups: Map<string, unknown[]> } {
  const groups = new Map<string, unknown[]>();
  let anonymous = 0;
  values.forEach((value) => {
    if (!isRecord(value) || !isNonEmptyString(value.id)) {
      anonymous += 1;
      return;
    }
    const group = groups.get(value.id) ?? [];
    group.push(value);
    groups.set(value.id, group);
  });
  return { anonymous, groups };
}

function parseRelationship(
  value: unknown,
  sourceById: Map<string, Source>,
  eventGroups: Map<string, unknown[]>
): ResolvedHistoricalRelationship | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) ||
      !Object.hasOwn(RELATIONSHIP_TYPE_LABELS, String(value.type)) ||
      !isNonEmptyString(value.summary) || !parsePeriods(value.periods) ||
      !parseParticipants(value.participants) || !hasUniqueStrings(value.eventIds) ||
      !parseConfidence(value)) return null;

  const refs = parseSourceRefs(value.sourceRefs);
  if (!refs) return null;
  const sources = refs.flatMap((ref) => {
    const source = sourceById.get(ref.sourceId);
    return source ? [{ ref, source }] : [];
  });
  if (sources.length !== refs.length) return null;

  const events: HistoricalEvent[] = [];
  for (const eventId of value.eventIds) {
    const candidates = eventGroups.get(eventId);
    if (!candidates || new Set(candidates.map((candidate) => JSON.stringify(candidate))).size !== 1) {
      return null;
    }
    const event = parseEvent(candidates[0], sourceById);
    if (!event) return null;
    events.push(event);
  }

  return { relationship: value as unknown as Relationship, events, sources };
}

/** 合并双方详情中的同一关系，逐条校验并解析其事件与来源闭包。 */
export function selectHistoricalRelationships(
  leftEntityId: string,
  rightEntityId: string,
  details: readonly CrownlineDetail[]
): HistoricalRelationshipSelection {
  const sourceById = new Map(
    details.flatMap(({ sources }) => sources).map((source) => [source.id, source])
  );
  const { groups: eventGroups } = groupById(
    details.flatMap(({ events }) => events) as unknown[]
  );
  const relationshipCandidates = groupById(
    details.flatMap(({ relationships }) => relationships) as unknown[]
  );
  const resolved: ResolvedHistoricalRelationship[] = [];
  let omittedCount = relationshipCandidates.anonymous;

  relationshipCandidates.groups.forEach((candidates) => {
    const pairStatuses = candidates.map((candidate) => {
      return rawHasPair(candidate, leftEntityId, rightEntityId);
    });
    if (!pairStatuses.includes(true)) {
      if (pairStatuses.includes(null)) omittedCount += 1;
      return;
    }
    if (new Set(candidates.map((candidate) => JSON.stringify(candidate))).size !== 1) {
      omittedCount += 1;
      return;
    }
    const relationship = parseRelationship(candidates[0], sourceById, eventGroups);
    if (relationship) resolved.push(relationship);
    else omittedCount += 1;
  });

  return {
    groups: TYPE_ORDER.flatMap((type) => {
      const relationships = resolved
        .filter(({ relationship }) => relationship.type === type)
        .sort((left, right) => {
          const leftPeriod = left.relationship.periods[0]!;
          const rightPeriod = right.relationship.periods[0]!;
          return leftPeriod.start.year - rightPeriod.start.year ||
            leftPeriod.end.year - rightPeriod.end.year ||
            left.relationship.id.localeCompare(right.relationship.id, "en");
        });
      return relationships.length > 0
        ? [{ type, label: RELATIONSHIP_TYPE_LABELS[type], relationships }]
        : [];
    }),
    omittedCount
  };
}
