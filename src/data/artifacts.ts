import type {
  CrownlineData,
  CrownlineDetail,
  CrownlineIndex,
  SourceRef
} from "../domain/types";

export interface GeneratedArtifacts {
  index: CrownlineIndex;
  details: Map<string, CrownlineDetail>;
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
  const details = new Map<string, CrownlineDetail>();

  data.entities.forEach((entity) => {
    const reigns = data.reigns.filter(({ polityId }) => polityId === entity.id);
    const reignVacancies = data.reignVacancies.filter(({ polityId }) => polityId === entity.id);
    const personIds = new Set(reigns.map(({ personId }) => personId));
    const persons = data.persons.filter(({ id }) => personIds.has(id));
    const relationships = data.relationships.filter(({ participants }) => {
      return participants.some(({ entityId }) => entityId === entity.id);
    });
    const relationshipEventIds = new Set(relationships.flatMap(({ eventIds }) => eventIds));
    const events = data.events.filter(({ id, participantEntityIds }) => {
      return relationshipEventIds.has(id) || participantEntityIds.includes(entity.id);
    });

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
      sources: data.sources.filter(({ id }) => sourceIds.has(id))
    });
  });

  return { index, details };
}
