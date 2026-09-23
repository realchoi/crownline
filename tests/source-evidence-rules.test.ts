import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import type { SourceRef } from "../src/domain/types";

const data = await loadSourceData();
const sourceById = new Map(data.sources.map((source) => [source.id, source]));

/** 同一网页列出全部君主的王表：定位必须写明具体条目，不能用整页通用定位掩盖不可复核的引用。 */
const NAMED_ENTRY_RULER_LISTS = [
  "source-wikipedia-byzantine-emperors",
  "source-goryeo-rulers"
] as const;

const citedRecords: Array<{ id: string; sourceRefs: SourceRef[] }> = [
  ...data.entities,
  ...data.persons,
  ...data.reigns,
  ...data.reignVacancies,
  ...data.relationships,
  ...data.events,
  ...data.geographicSnapshots
];

describe("来源定位规则", () => {
  it.each(NAMED_ENTRY_RULER_LISTS)("引用 %s 的人物与任期都按具名条目定位", (sourceId) => {
    const personById = new Map(data.persons.map((person) => [person.id, person]));
    const persons = data.persons.filter(({ sourceRefs }) =>
      sourceRefs.some((sourceRef) => sourceRef.sourceId === sourceId)
    );
    const reigns = data.reigns.filter(({ sourceRefs }) =>
      sourceRefs.some((sourceRef) => sourceRef.sourceId === sourceId)
    );
    expect(persons.length, sourceId).toBeGreaterThan(0);
    expect(reigns.length, sourceId).toBeGreaterThan(0);

    for (const person of persons) {
      const alias = person.names.aliases[0];
      expect(alias, person.id).toBeDefined();
      for (const sourceRef of person.sourceRefs.filter((ref) => ref.sourceId === sourceId)) {
        expect(sourceRef.locator, person.id).toContain(alias);
      }
    }
    for (const reign of reigns) {
      const alias = personById.get(reign.personId)?.names.aliases[0];
      expect(alias, reign.id).toBeDefined();
      for (const sourceRef of reign.sourceRefs.filter((ref) => ref.sourceId === sourceId)) {
        expect(sourceRef.locator, reign.id).toContain(alias);
      }
    }
  });

  it("locator 中记录的检索日期不晚于来源登记的访问日期", () => {
    for (const record of citedRecords) {
      for (const sourceRef of record.sourceRefs) {
        const retrievedAt = sourceRef.locator?.match(/(\d{4}-\d{2}-\d{2})检索/)?.[1];
        if (!retrievedAt) continue;
        const accessedAt = sourceById.get(sourceRef.sourceId)?.accessedAt;
        expect(accessedAt, `${record.id} → ${sourceRef.sourceId}`).toBeDefined();
        expect(accessedAt! >= retrievedAt, `${record.id} → ${sourceRef.sourceId}`).toBe(true);
      }
    }
  });
});
