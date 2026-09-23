import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";

const data = await loadSourceData();
const sourceById = new Map(data.sources.map((source) => [source.id, source]));

/** 维基文库校录的正史与编年史：必须写到卷次与公元年，读者才能在同一部书中复核原句。 */
const isWikisourceChronicle = (sourceId: string) =>
  sourceById.get(sourceId)?.url?.startsWith("https://zh.wikisource.org/") ?? false;

describe("结构化关系来源规则", () => {
  it("每条关系的每项引用都带 locator", () => {
    for (const relationship of data.relationships) {
      for (const sourceRef of relationship.sourceRefs) {
        expect(
          sourceRef.locator?.trim(),
          `${relationship.id} → ${sourceRef.sourceId}`
        ).toBeTruthy();
      }
    }
  });

  it("引用正史或编年史时写明卷次和对应公元年", () => {
    for (const relationship of data.relationships) {
      for (const sourceRef of relationship.sourceRefs) {
        if (!isWikisourceChronicle(sourceRef.sourceId)) continue;
        const label = `${relationship.id} → ${sourceRef.sourceId}`;
        expect(sourceRef.locator, label).toMatch(/卷/);
        expect(sourceRef.locator, label).toMatch(/（-?\d+）/);
      }
    }
  });

  it("臣属关系说明被臣属方保留的王统、自治或统治边界", () => {
    for (const relationship of data.relationships) {
      if (relationship.type !== "vassalage") continue;
      expect(
        `${relationship.summary}${relationship.confidenceNote ?? ""}`,
        relationship.id
      ).toMatch(/保留|自治/);
    }
  });
});
