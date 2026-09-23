import { describe, expect, it } from "vitest";

import { loadCoverageReviewData } from "../scripts/coverage-review";
import { loadSourceData } from "../scripts/data-source";
import { buildDataCoverageReport } from "../src/data/coverageReport";

const data = await loadSourceData();
const coverageReview = await loadCoverageReviewData(undefined, data);
const report = buildDataCoverageReport(data, coverageReview);

const entityIds = [
  "polity-abbasid-caliphate",
  "polity-byzantine-empire",
  "polity-chalukya-dynasty",
  "polity-chola-empire",
  "polity-goryeo",
  "polity-holy-roman-empire",
  "polity-kingdom-of-england",
  "polity-ottoman-empire",
  "polity-safavid-iran",
  "polity-sasanian-empire",
  "polity-tokugawa-shogunate",
  "polity-umayyad-caliphate"
] as const;

const geographyIds = [
  "geo-chalukya-badami",
  "geo-chola-gangaikonda",
  "geo-chola-thanjavur",
  "geo-ottoman-istanbul",
  "geo-safavid-isfahan",
  "geo-sasanian-ctesiphon",
  "geo-tokugawa-edo",
  "geo-umayyad-damascus"
] as const;

const hasLocator = (sourceRefs: Array<{ locator?: string }>) =>
  sourceRefs.some(({ locator }) => Boolean(locator?.trim()));

describe("第一批全记录来源定位 P0", () => {
  it("把12个核心政权的概述定位到具体页面段落", () => {
    for (const id of entityIds) {
      const entity = data.entities.find(({ id: candidateId }) => candidateId === id);
      expect(entity, id).toBeDefined();
      expect(hasLocator(entity!.sourceRefs), id).toBe(true);
    }
  });

  it.each(["polity-byzantine-empire", "polity-goryeo"])(
    "%s 的人物与任期均定位到对应王表",
    (polityId) => {
      const reigns = data.reigns.filter(({ polityId: candidateId }) => candidateId === polityId);
      const personIds = new Set(reigns.map(({ personId }) => personId));
      const persons = data.persons.filter(({ id }) => personIds.has(id));

      expect(persons.length, polityId).toBeGreaterThan(0);
      expect(reigns.length, polityId).toBeGreaterThan(0);
      expect(
        persons.every(({ sourceRefs }) => hasLocator(sourceRefs)),
        polityId
      ).toBe(true);
      expect(
        reigns.every(({ sourceRefs }) => hasLocator(sourceRefs)),
        polityId
      ).toBe(true);
    }
  );

  it.each([
    ["polity-byzantine-empire", "source-wikipedia-byzantine-emperors"],
    ["polity-goryeo", "source-goryeo-rulers"]
  ])("%s 的王表 locator 指明具体人物", (polityId, sourceId) => {
    const reigns = data.reigns.filter(({ polityId: candidateId }) => candidateId === polityId);
    const personIds = new Set(reigns.map(({ personId }) => personId));
    const persons = data.persons.filter(({ id }) => personIds.has(id));
    const personById = new Map(persons.map((person) => [person.id, person]));

    for (const person of persons) {
      const alias = person.names.aliases[0];
      expect(alias, person.id).toBeDefined();
      expect(
        person.sourceRefs.find((sourceRef) => sourceRef.sourceId === sourceId)?.locator,
        person.id
      ).toContain(alias);
    }
    for (const reign of reigns) {
      const alias = personById.get(reign.personId)?.names.aliases[0];
      expect(alias, reign.id).toBeDefined();
      expect(
        reign.sourceRefs.find((sourceRef) => sourceRef.sourceId === sourceId)?.locator,
        reign.id
      ).toContain(alias);
    }
  });

  it("把8条跨地区点位定位到历史依据与具体坐标对象", () => {
    for (const id of geographyIds) {
      const snapshot = data.geographicSnapshots.find(({ id: candidateId }) => candidateId === id);
      expect(snapshot, id).toBeDefined();
      expect(
        snapshot!.sourceRefs.every(({ locator }) => Boolean(locator?.trim())),
        id
      ).toBe(true);
      expect(
        snapshot!.sourceRefs.some(({ sourceId }) => sourceId === "source-geonames"),
        id
      ).toBe(false);
    }
  });

  it("将四类无定位记录预算至少收紧10%", () => {
    expect(report.sourceReferenceQuality.entities.recordsWithoutLocatedSourceRefs).toBe(102);
    expect(report.sourceReferenceQuality.persons.recordsWithoutLocatedSourceRefs).toBe(1067);
    expect(report.sourceReferenceQuality.reigns.recordsWithoutLocatedSourceRefs).toBe(1103);
    expect(
      report.sourceReferenceQuality.geographicSnapshots.recordsWithoutLocatedSourceRefs
    ).toBeLessThanOrEqual(67);
  });
});
