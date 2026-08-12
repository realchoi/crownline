import { describe, expect, it } from "vitest";

import { selectHistoricalRelationships } from "../src/domain/historicalRelationships";
import type {
  CrownlineDetail,
  HistoricalEvent,
  HistoricalInterval,
  Relationship,
  Source
} from "../src/domain/types";

const period = (start: number, end = start): HistoricalInterval => ({
  start: { year: start, precision: "exact" },
  end: { year: end, precision: "exact" }
});

const source: Source = {
  id: "source-a-b",
  title: "甲乙关系史料",
  sourceType: "secondary",
  citation: "甲乙关系史料完整引文。",
  url: "https://example.com/source-a-b"
};

const battle: HistoricalEvent = {
  id: "event-a-b-battle",
  type: "battle",
  title: "甲乙之战",
  periods: [period(100)],
  participantEntityIds: ["polity-a", "polity-b"],
  regionIds: [],
  summary: "甲乙双方在一百年发生战斗。",
  sourceRefs: [{ sourceId: source.id }],
  confidence: "high"
};

const war: Relationship = {
  id: "relationship-a-b-war",
  type: "war",
  participants: [
    { entityId: "polity-a", role: "交战方" },
    { entityId: "polity-b", role: "交战方" }
  ],
  periods: [period(100)],
  summary: "甲乙双方发生战争。",
  eventIds: [battle.id],
  sourceRefs: [{ sourceId: source.id, locator: "第1章" }],
  confidence: "high"
};

function detail(
  entityId: string,
  relationships: unknown[],
  events: unknown[] = [battle],
  sources: Source[] = [source]
): CrownlineDetail {
  return {
    schemaVersion: 3,
    entityId,
    persons: [],
    reigns: [],
    reignVacancies: [],
    relationships: relationships as Relationship[],
    events: events as HistoricalEvent[],
    sources
  };
}

describe("结构化历史关系选择", () => {
  it("只选择当前政权对的关系，并解析事件与来源", () => {
    const unrelated: Relationship = {
      ...war,
      id: "relationship-a-c-war",
      participants: [
        { entityId: "polity-a", role: "交战方" },
        { entityId: "polity-c", role: "交战方" }
      ]
    };

    const result = selectHistoricalRelationships("polity-a", "polity-b", [
      detail("polity-a", [war, unrelated]),
      detail("polity-b", [war])
    ]);

    expect(result.omittedCount).toBe(0);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      type: "war",
      label: "战争",
      relationships: [{
        relationship: { id: "relationship-a-b-war" },
        events: [{ id: "event-a-b-battle" }],
        sources: [{
          ref: { sourceId: "source-a-b", locator: "第1章" },
          source: { id: "source-a-b" }
        }]
      }]
    });
  });

  it("按固定类型顺序分组，并按最早起始年排列组内关系", () => {
    const laterWar: Relationship = {
      ...war,
      id: "relationship-a-b-later-war",
      periods: [period(300)]
    };
    const diplomacy: Relationship = {
      ...war,
      id: "relationship-a-b-diplomacy",
      type: "diplomacy",
      periods: [period(50)],
      eventIds: []
    };

    const result = selectHistoricalRelationships("polity-a", "polity-b", [
      detail("polity-a", [laterWar, diplomacy, war])
    ]);

    expect(result.groups.map(({ type }) => type)).toEqual(["war", "diplomacy"]);
    expect(result.groups[0]?.relationships.map(({ relationship }) => relationship.id)).toEqual([
      "relationship-a-b-war",
      "relationship-a-b-later-war"
    ]);
  });

  it.each([
    ["未知类型（包括对象原型键）", { ...war, type: "toString" }],
    ["重复参与方", {
      ...war,
      participants: [...war.participants, { entityId: "polity-a", role: "重复方" }]
    }],
    ["反向区间", { ...war, periods: [period(200, 100)] }],
    ["公元零年", { ...war, periods: [period(0, 1)] }],
    ["空摘要", { ...war, summary: "  " }],
    ["争议说明缺失", { ...war, confidence: "disputed" }],
    ["空来源", { ...war, sourceRefs: [] }],
    ["悬空来源", { ...war, sourceRefs: [{ sourceId: "source-missing" }] }],
    ["悬空事件", { ...war, eventIds: ["event-missing"] }]
  ])("跳过%s且保留同批有效关系", (_label, invalid) => {
    const invalidWithUniqueId = { ...invalid, id: "relationship-invalid" };
    const result = selectHistoricalRelationships("polity-a", "polity-b", [
      detail("polity-a", [war, invalidWithUniqueId])
    ]);

    expect(result.groups.flatMap(({ relationships }) => relationships)
      .map(({ relationship }) => relationship.id)).toEqual(["relationship-a-b-war"]);
    expect(result.omittedCount).toBe(1);
  });

  it("事件记录损坏时只跳过引用它的关系", () => {
    const invalid = { ...war, id: "relationship-bad-event", eventIds: ["event-bad"] };
    const result = selectHistoricalRelationships("polity-a", "polity-b", [
      detail("polity-a", [war, invalid], [battle, { id: "event-bad" }])
    ]);

    expect(result.groups.flatMap(({ relationships }) => relationships)
      .map(({ relationship }) => relationship.id)).toEqual(["relationship-a-b-war"]);
    expect(result.omittedCount).toBe(1);
  });

  it("同一 ID 内容冲突时不任意选择其中一份", () => {
    const conflict = { ...war, summary: "另一份相互冲突的摘要。" };
    const result = selectHistoricalRelationships("polity-a", "polity-b", [
      detail("polity-a", [war]),
      detail("polity-b", [conflict])
    ]);

    expect(result.groups).toEqual([]);
    expect(result.omittedCount).toBe(1);
  });
});
