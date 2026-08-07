import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import type { CrownlineData } from "../src/domain/types";

const data: CrownlineData = await loadSourceData();

describe("运行时数据产物", () => {
  it("首屏索引不携带详情数组", () => {
    const { index } = buildGeneratedArtifacts(data);

    expect(index).not.toHaveProperty("persons");
    expect(index).not.toHaveProperty("reigns");
    expect(index).not.toHaveProperty("reignVacancies");
    expect(index).not.toHaveProperty("relationships");
    expect(index).not.toHaveProperty("events");
    expect(index).not.toHaveProperty("sources");
    expect(index.detailEntityIds).toEqual(data.entities.map(({ id }) => id));
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
  });

  it("为新增非主线政权生成可独立加载的详情闭包", () => {
    const wei = buildGeneratedArtifacts(data).details.get("polity-cn-cao-wei");

    expect(wei?.persons.length).toBeGreaterThan(0);
    expect(wei?.reigns.every(({ polityId }) => polityId === "polity-cn-cao-wei"))
      .toBe(true);
    expect(wei?.sources.length).toBeGreaterThan(0);
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
});
