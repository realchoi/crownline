import { describe, expect, it } from "vitest";

import { readBrowseState, getHistoricalYearBounds } from "../src/domain/browseState";
import { isYearInPeriods } from "../src/domain/chronology";
import { loadSourceData } from "../scripts/data-source";

const data = await loadSourceData();
const legacyId = "polity-maya-city-states";
const polityIds = [
  "polity-maya-tikal",
  "polity-maya-palenque",
  "polity-maya-calakmul",
  "polity-maya-copan"
] as const;

describe("古典期玛雅主体拆分", () => {
  it("保留旧详情 ID 为历史分期，并排除政权专属记录", () => {
    const legacy = data.entities.find(({ id }) => id === legacyId);
    expect(legacy).toMatchObject({
      entityKind: "historical-period",
      polityForms: [],
      names: { primary: "古典期玛雅诸城邦" }
    });
    expect(data.reigns.some(({ polityId }) => polityId === legacyId)).toBe(false);
    expect(data.reignVacancies.some(({ polityId }) => polityId === legacyId)).toBe(false);
    expect(data.geographicSnapshots.some(({ polityId }) => polityId === legacyId)).toBe(false);
    expect(
      data.relationships.some(({ participants }) =>
        participants.some(({ entityId }) => entityId === legacyId)
      )
    ).toBe(false);
    expect(
      data.events.some(({ participantEntityIds }) => participantEntityIds.includes(legacyId))
    ).toBe(false);
  });

  it("把人物和任期迁到四个真实城邦，不制造统一王统", () => {
    expect(
      Object.fromEntries(
        polityIds.map((polityId) => [
          polityId,
          data.reigns
            .filter((reign) => reign.polityId === polityId)
            .map(({ personId }) => personId)
            .sort()
        ])
      )
    ).toEqual({
      "polity-maya-tikal": ["person-maya-jasaw-chan-kawiil"],
      "polity-maya-palenque": ["person-maya-pakal"],
      "polity-maya-calakmul": ["person-maya-yuknoom-great"],
      "polity-maya-copan": ["person-maya-k-ahk", "person-maya-waxaklajuun-ubaah-kawiil"]
    });

    for (const polityId of polityIds) {
      expect(data.entities.find(({ id }) => id === polityId)?.entityKind).toBe("polity");
    }
  });

  it("把378年事件与相关关系收窄到蒂卡尔", () => {
    const event = data.events.find(({ id }) => id === "event-teotihuacan-tikal-entrada-378");
    expect(event?.participantEntityIds).toEqual(["polity-teotihuacan-state", "polity-maya-tikal"]);

    for (const relationshipId of [
      "relationship-teotihuacan-maya-war",
      "relationship-teotihuacan-maya-cultural-exchange"
    ]) {
      expect(
        data.relationships
          .find(({ id }) => id === relationshipId)
          ?.participants.map(({ entityId }) => entityId)
      ).toEqual(["polity-teotihuacan-state", "polity-maya-tikal"]);
    }
  });

  it("更正科潘第11位君主，不再混入基里瓜 Cauac Sky", () => {
    const ruler = data.persons.find(({ id }) => id === "person-maya-k-ahk");
    expect(ruler?.names).toMatchObject({
      primary: "卡克·钱·约帕特",
      aliases: expect.arrayContaining(["K'ak' Chan Yopaat", "Butz' Chan"])
    });
    expect(ruler?.names.aliases).not.toEqual(
      expect.arrayContaining(["K'ahk' Tiliw Chan Yopaat", "Cauac Sky"])
    );
    expect(data.reigns.find(({ id }) => id === "reign-maya-k-ahk")).toMatchObject({
      polityId: "polity-maya-copan",
      periods: [{ start: { year: 578 }, end: { year: 628 } }]
    });
  });

  it("把旧详情链接保留为分期，但从旧对比参数中清除", () => {
    const bounds = getHistoricalYearBounds(data);
    const state = readBrowseState(
      `?detail=${legacyId}&compare=${legacyId}&compare=polity-maya-tikal&comparison=open`,
      bounds,
      data.regions,
      data.entities
    );

    expect(state.detailEntityId).toBe(legacyId);
    expect(state.compareEntityIds).toEqual(["polity-maya-tikal"]);
    expect(state.comparisonOpen).toBe(false);
  });

  it("把四个机构来源已审查的政治中心分别归入真实城邦", () => {
    const snapshot = data.geographicSnapshots.find(({ id }) => id === "geo-maya-tikal");
    expect(snapshot).toMatchObject({
      polityId: "polity-maya-tikal",
      positionPrecision: "regional",
      coordinates: { latitude: 17.2167, longitude: -89.6167 }
    });
    expect(snapshot?.sourceRefs.every(({ locator }) => Boolean(locator?.trim()))).toBe(true);
    expect(isYearInPeriods(378, snapshot!.periods)).toBe(true);
    expect(isYearInPeriods(901, snapshot!.periods)).toBe(false);
    expect(
      Object.fromEntries(
        polityIds.map((polityId) => [
          polityId,
          data.geographicSnapshots
            .filter((candidate) => candidate.polityId === polityId)
            .map(({ placeName }) => placeName)
        ])
      )
    ).toEqual({
      "polity-maya-tikal": ["Tikal"],
      "polity-maya-palenque": ["Palenque"],
      "polity-maya-calakmul": ["Calakmul"],
      "polity-maya-copan": ["Copán"]
    });
    for (const polityId of polityIds) {
      expect(
        data.geographicSnapshots
          .filter((candidate) => candidate.polityId === polityId)
          .every(({ sourceRefs }) => sourceRefs.every(({ locator }) => Boolean(locator?.trim())))
      ).toBe(true);
    }
  });
});
