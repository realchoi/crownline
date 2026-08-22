import type {
  CrownlineData,
  CrownlineDetail,
  CrownlineGeography,
  CrownlineIndex,
  SourceRef
} from "../domain/types";

export interface GeneratedArtifacts {
  index: CrownlineIndex;
  geography: CrownlineGeography;
  details: Map<string, CrownlineDetail>;
}

function groupByKey<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  values.forEach((value) => {
    const id = key(value);
    const group = groups.get(id) ?? [];
    group.push(value);
    groups.set(id, group);
  });
  return groups;
}

function groupByKeys<T>(values: readonly T[], keys: (value: T) => readonly string[]) {
  const groups = new Map<string, T[]>();
  values.forEach((value) => {
    keys(value).forEach((id) => {
      const group = groups.get(id) ?? [];
      group.push(value);
      groups.set(id, group);
    });
  });
  return groups;
}

function selectInSourceOrder<T extends { id: string }>(
  ids: ReadonlySet<string>,
  valuesById: ReadonlyMap<string, T>,
  orderById: ReadonlyMap<string, number>
): T[] {
  return Array.from(ids)
    .flatMap((id) => {
      const value = valuesById.get(id);
      return value ? [value] : [];
    })
    .sort((left, right) => (orderById.get(left.id) ?? 0) - (orderById.get(right.id) ?? 0));
}

/** 从通过全量校验的数据派生首屏索引和独立实体详情包。 */
export function buildGeneratedArtifacts(data: CrownlineData): GeneratedArtifacts {
  const index: CrownlineIndex = {
    schemaVersion: data.schemaVersion,
    chronologyPolicy: data.chronologyPolicy,
    timelineSections: data.timelineSections,
    entities: data.entities,
    regions: data.regions,
    detailEntityIds: data.entities.map(({ id }) => id)
  };
  const sourceById = new Map(data.sources.map((source) => [source.id, source]));
  const sourceOrderById = new Map(data.sources.map(({ id }, index) => [id, index]));
  const personById = new Map(data.persons.map((person) => [person.id, person]));
  const personOrderById = new Map(data.persons.map(({ id }, index) => [id, index]));
  const eventById = new Map(data.events.map((event) => [event.id, event]));
  const eventOrderById = new Map(data.events.map(({ id }, index) => [id, index]));
  const reignsByPolityId = groupByKey(data.reigns, ({ polityId }) => polityId);
  const vacanciesByPolityId = groupByKey(data.reignVacancies, ({ polityId }) => polityId);
  const relationshipsByEntityId = groupByKeys(data.relationships, ({ participants }) => {
    return participants.map(({ entityId }) => entityId);
  });
  const eventsByEntityId = groupByKeys(data.events, ({ participantEntityIds }) => {
    return participantEntityIds;
  });
  const geographySourceIds = new Set(
    data.geographicSnapshots.flatMap(({ sourceRefs }) => {
      return sourceRefs.map(({ sourceId }) => sourceId);
    })
  );
  const geography: CrownlineGeography = {
    schemaVersion: data.schemaVersion,
    geographicSnapshots: data.geographicSnapshots,
    sources: selectInSourceOrder(geographySourceIds, sourceById, sourceOrderById)
  };
  const details = new Map<string, CrownlineDetail>();

  data.entities.forEach((entity) => {
    const reigns = reignsByPolityId.get(entity.id) ?? [];
    const reignVacancies = vacanciesByPolityId.get(entity.id) ?? [];
    const personIds = new Set(reigns.map(({ personId }) => personId));
    const persons = selectInSourceOrder(personIds, personById, personOrderById);
    const relationships = relationshipsByEntityId.get(entity.id) ?? [];
    const relationshipEventIds = new Set(relationships.flatMap(({ eventIds }) => eventIds));
    const eventIds = new Set([
      ...relationshipEventIds,
      ...(eventsByEntityId.get(entity.id) ?? []).map(({ id }) => id)
    ]);
    const events = selectInSourceOrder(eventIds, eventById, eventOrderById);

    const sourceIds = new Set<string>();
    const collectSourceRefs = (refs: SourceRef[]) => {
      refs.forEach(({ sourceId }) => sourceIds.add(sourceId));
    };
    collectSourceRefs(entity.sourceRefs);
    entity.alternativeChronologies?.forEach(({ sourceRefs }) => collectSourceRefs(sourceRefs));
    persons.forEach(({ sourceRefs }) => collectSourceRefs(sourceRefs));
    reigns.forEach(({ sourceRefs }) => collectSourceRefs(sourceRefs));
    reignVacancies.forEach(({ sourceRefs }) => collectSourceRefs(sourceRefs));
    relationships.forEach(({ sourceRefs }) => collectSourceRefs(sourceRefs));
    events.forEach(({ sourceRefs }) => collectSourceRefs(sourceRefs));

    details.set(entity.id, {
      schemaVersion: data.schemaVersion,
      entityId: entity.id,
      persons,
      reigns,
      reignVacancies,
      relationships,
      events,
      sources: selectInSourceOrder(sourceIds, sourceById, sourceOrderById)
    });
  });

  return { index, geography, details };
}
