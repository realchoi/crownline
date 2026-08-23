import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import type { CrownlineData } from "../src/domain/types";
import { GLOBAL_SAMPLE_POLITY_IDS } from "./global-sample-polities";

const data: CrownlineData = await loadSourceData();

describe("运行时数据产物", () => {
  it("首屏索引不携带详情数组", () => {
    const { index } = buildGeneratedArtifacts(data);

    expect(index).not.toHaveProperty("persons");
    expect(index).not.toHaveProperty("reigns");
    expect(index).not.toHaveProperty("reignVacancies");
    expect(index).not.toHaveProperty("relationships");
    expect(index).not.toHaveProperty("events");
    expect(index).not.toHaveProperty("geographicSnapshots");
    expect(index).not.toHaveProperty("sources");
    expect(index.detailEntityIds).toEqual(data.entities.map(({ id }) => id));
  });

  it("疆域坐标只进入独立 boundaries 包并保持来源闭包", () => {
    const artifacts = buildGeneratedArtifacts(data);
    expect(artifacts.index).not.toHaveProperty("boundarySnapshots");
    expect(artifacts.geography).not.toHaveProperty("boundarySnapshots");
    artifacts.details.forEach((detail) => {
      expect(detail).not.toHaveProperty("boundarySnapshots");
      expect(JSON.stringify(detail)).not.toContain("MultiPolygon");
    });
    expect(artifacts.boundaries.boundarySnapshots).toHaveLength(8);
    expect(artifacts.boundaries.sources.map(({ id }) => id)).toEqual([
      "source-cn-chronology-table",
      "source-ohm-boundaries",
      "source-met-byzantium",
      "source-met-abbasid",
      "source-ottoman-history"
    ]);
    const sourceIds = new Set(artifacts.boundaries.sources.map(({ id }) => id));
    expect(
      artifacts.boundaries.boundarySnapshots
        .flatMap(({ sourceRefs }) => sourceRefs)
        .every(({ sourceId }) => sourceIds.has(sourceId))
    ).toBe(true);
  });

  it("独立地理产物只收集地理快照引用的来源", () => {
    const fixture: CrownlineData = structuredClone(data);
    fixture.sources.push(
      {
        id: "source-map-test",
        title: "地图测试来源",
        sourceType: "dataset",
        citation: "用于验证地理来源闭包。"
      },
      {
        id: "source-map-unrelated",
        title: "无关地图测试来源",
        sourceType: "dataset",
        citation: "不得进入地理来源闭包。"
      }
    );
    fixture.geographicSnapshots.push({
      id: "geo-tang-changan-test",
      polityId: "polity-cn-tang",
      periods: [
        {
          start: { year: 618, precision: "exact" },
          end: { year: 690, precision: "exact" }
        }
      ],
      placeName: "长安",
      role: "capital",
      coordinates: { latitude: 34.2658, longitude: 108.9541 },
      positionPrecision: "approximate",
      positionNote: "测试坐标，仅用于示意。",
      sourceRefs: [{ sourceId: "source-map-test" }],
      confidence: "high"
    });

    const { geography } = buildGeneratedArtifacts(fixture);

    expect(geography).toMatchObject({
      schemaVersion: 5,
      geographicSnapshots: fixture.geographicSnapshots
    });
    const geographySourceIds = geography.sources.map(({ id }) => id);
    expect(geographySourceIds).toContain("source-map-test");
    expect(geographySourceIds).not.toContain("source-map-unrelated");
    expect(
      geography.geographicSnapshots
        .flatMap(({ sourceRefs }) => sourceRefs)
        .every(({ sourceId }) => geographySourceIds.includes(sourceId))
    ).toBe(true);
  });

  it("详情只收集目标政权的任期及其人物和来源闭包", () => {
    const tang = buildGeneratedArtifacts(data).details.get("polity-cn-tang");

    expect(tang).toBeDefined();
    expect(tang?.reigns.length).toBeGreaterThan(0);
    expect(tang?.reigns.every(({ polityId }) => polityId === "polity-cn-tang")).toBe(true);
    expect(new Set(tang?.persons.map(({ id }) => id))).toEqual(
      new Set(tang?.reigns.map(({ personId }) => personId))
    );
    expect(tang?.sources.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["source-cn-chronology-table"])
    );
    const tangPersonIds = new Set(tang?.reigns.map(({ personId }) => personId));
    expect(tang?.persons).toEqual(data.persons.filter(({ id }) => tangPersonIds.has(id)));
    const tangSourceIds = new Set(tang?.sources.map(({ id }) => id));
    expect(tang?.sources).toEqual(data.sources.filter(({ id }) => tangSourceIds.has(id)));
  });

  it("为新增非主线政权生成可独立加载的详情闭包", () => {
    const wei = buildGeneratedArtifacts(data).details.get("polity-cn-cao-wei");

    expect(wei?.persons.length).toBeGreaterThan(0);
    expect(wei?.reigns.every(({ polityId }) => polityId === "polity-cn-cao-wei")).toBe(true);
    expect(wei?.sources.length).toBeGreaterThan(0);
  });

  it("预索引生成对全部实体保持原有详情闭包和源数组顺序", () => {
    const { details } = buildGeneratedArtifacts(data);

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
      const sourceIds = new Set(
        [
          ...entity.sourceRefs,
          ...(entity.alternativeChronologies?.flatMap(({ sourceRefs }) => sourceRefs) ?? []),
          ...persons.flatMap(({ sourceRefs }) => sourceRefs),
          ...reigns.flatMap(({ sourceRefs }) => sourceRefs),
          ...reignVacancies.flatMap(({ sourceRefs }) => sourceRefs),
          ...relationships.flatMap(({ sourceRefs }) => sourceRefs),
          ...events.flatMap(({ sourceRefs }) => sourceRefs)
        ].map(({ sourceId }) => sourceId)
      );

      expect(details.get(entity.id), entity.id).toEqual({
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
  });

  it("为拜占庭帝国生成独立详情闭包", () => {
    const detail = buildGeneratedArtifacts(data).details.get("polity-byzantine-empire");

    expect(detail?.persons.length).toBeGreaterThanOrEqual(80);
    expect(detail?.reigns.every(({ polityId }) => polityId === "polity-byzantine-empire")).toBe(
      true
    );
    expect(new Set(detail?.persons.map(({ id }) => id))).toEqual(
      new Set(detail?.reigns.map(({ personId }) => personId))
    );
    expect(detail?.sources.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["source-met-byzantium", "source-wikipedia-byzantine-emperors"])
    );
  });

  it("为四个世界政权生成可独立加载的详情闭包", () => {
    for (const entityId of [
      "polity-byzantine-empire",
      "polity-abbasid-caliphate",
      "polity-holy-roman-empire",
      "polity-chola-empire"
    ]) {
      const detail = buildGeneratedArtifacts(data).details.get(entityId);
      expect(detail?.persons.length, entityId).toBeGreaterThan(0);
      expect(detail?.reigns.length, entityId).toBeGreaterThan(0);
      expect(
        detail?.reigns.every(({ polityId }) => polityId === entityId),
        entityId
      ).toBe(true);
      expect(new Set(detail?.persons.map(({ id }) => id)), entityId).toEqual(
        new Set(detail?.reigns.map(({ personId }) => personId))
      );
      expect(detail?.sources.length, entityId).toBeGreaterThan(0);
    }
  });

  it("为十六个全球样本政权生成详情闭包契约", () => {
    const { details } = buildGeneratedArtifacts(data);

    for (const entityId of GLOBAL_SAMPLE_POLITY_IDS) {
      const detail = details.get(entityId);

      expect(detail, entityId).toBeDefined();
      expect(detail!.reigns.length, entityId).toBeGreaterThan(0);
      expect(
        detail!.reigns.every(({ polityId }) => polityId === entityId),
        entityId
      ).toBe(true);
      expect(new Set(detail!.persons.map(({ id }) => id)), entityId).toEqual(
        new Set(detail!.reigns.map(({ personId }) => personId))
      );
      expect(detail!.sources.length, entityId).toBeGreaterThan(0);
    }
  });

  it("共享关系、关系事件和来源进入双方详情", () => {
    const fixture: CrownlineData = structuredClone(data);
    fixture.events.push({
      id: "event-sui-tang-transition",
      type: "succession",
      title: "隋唐更替",
      periods: [
        {
          start: { year: 618, precision: "exact" },
          end: { year: 618, precision: "exact" }
        }
      ],
      participantEntityIds: ["polity-cn-sui", "polity-cn-tang"],
      regionIds: ["region-china"],
      summary: "用于验证详情闭包的测试事件。",
      sourceRefs: [{ sourceId: "source-cn-chronology-table" }],
      confidence: "high"
    });
    fixture.relationships.push({
      id: "relationship-sui-tang-transition",
      type: "war",
      participants: [
        { entityId: "polity-cn-sui", role: "前朝" },
        { entityId: "polity-cn-tang", role: "后继政权" }
      ],
      periods: [
        {
          start: { year: 618, precision: "exact" },
          end: { year: 618, precision: "exact" }
        }
      ],
      summary: "用于验证共享关系分发的测试关系。",
      eventIds: ["event-sui-tang-transition"],
      sourceRefs: [{ sourceId: "source-cn-chronology-table" }],
      confidence: "high"
    });

    const { details } = buildGeneratedArtifacts(fixture);
    for (const entityId of ["polity-cn-sui", "polity-cn-tang"]) {
      const detail = details.get(entityId);
      expect(detail?.relationships.map(({ id }) => id)).toContain(
        "relationship-sui-tang-transition"
      );
      expect(detail?.events.map(({ id }) => id)).toContain("event-sui-tang-transition");
      expect(detail?.sources.map(({ id }) => id)).toContain("source-cn-chronology-table");
    }
  });

  it("把生产关系闭包分发给双方且不污染无关详情", () => {
    const { details } = buildGeneratedArtifacts(data);
    const relationshipId = "relationship-byzantine-seljuk-manzikert-war";

    for (const entityId of ["polity-byzantine-empire", "polity-seljuk-empire"]) {
      const detail = details.get(entityId);
      expect(detail?.relationships.map(({ id }) => id)).toContain(relationshipId);
      expect(detail?.events.map(({ id }) => id)).toContain("event-battle-of-manzikert");
      expect(detail?.sources.map(({ id }) => id)).toContain("source-worldhistory-manzikert");
    }

    expect(details.get("polity-cn-ming")?.relationships.map(({ id }) => id)).not.toContain(
      relationshipId
    );
    expect(details.get("polity-cn-tang")?.relationships.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "relationship-tang-balhae-tribute",
        "relationship-tang-balhae-cultural-exchange"
      ])
    );
  });

  it("把本批次关系、事件和来源闭包分发到双方", () => {
    const { details, geography } = buildGeneratedArtifacts(data);
    const cases = [
      {
        relationshipId: "relationship-yuan-sukhothai-tribute",
        eventId: "event-yuan-sukhothai-embassy",
        sourceId: "source-promboon-sino-siamese-tribute",
        entityIds: ["polity-cn-yuan", "polity-sukhothai-kingdom"]
      },
      {
        relationshipId: "relationship-great-zimbabwe-kilwa-gold-trade",
        eventId: undefined,
        sourceId: "source-unesco-kilwa-trade",
        entityIds: ["polity-great-zimbabwe", "polity-kilwa-sultanate"]
      },
      {
        relationshipId: "relationship-aztec-purepecha-war",
        eventId: "event-aztec-purepecha-battle",
        sourceId: "source-met-aztec-tarascan",
        entityIds: ["polity-aztec-empire", "polity-purepecha-empire"]
      }
    ] as const;

    for (const testCase of cases) {
      for (const entityId of testCase.entityIds) {
        const detail = details.get(entityId);
        expect(
          detail?.relationships.map(({ id }) => id),
          entityId
        ).toContain(testCase.relationshipId);
        if (testCase.eventId) {
          expect(
            detail?.events.map(({ id }) => id),
            entityId
          ).toContain(testCase.eventId);
        }
        expect(
          detail?.sources.map(({ id }) => id),
          entityId
        ).toContain(testCase.sourceId);
      }
    }

    expect(geography.sources.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "source-accws-ancient-capitals",
        "source-cambridge-six-dynasties-capitals",
        "source-brill-manchu-capitals"
      ])
    );
    expect(details.get("polity-cn-ming")?.sources.map(({ id }) => id)).not.toContain(
      "source-cambridge-six-dynasties-capitals"
    );
  });
});
