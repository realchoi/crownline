import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildDataCoverageReport } from "../src/data/coverageReport";
import { isYearInPeriods } from "../src/domain/chronology";

const data = await loadSourceData();
const abbasidPlaces = (year: number) =>
  data.geographicSnapshots
    .filter(
      (snapshot) =>
        snapshot.polityId === "polity-abbasid-caliphate" && isYearInPeriods(year, snapshot.periods)
    )
    .map(({ placeName }) => placeName)
    .sort();

describe("阿拔斯哈里发萨迈拉分期点位", () => {
  it("保留巴格达与萨迈拉的分期边界及早期未知状态", () => {
    expect(abbasidPlaces(761)).toEqual([]);
    expect(abbasidPlaces(762)).toEqual(["Baghdad"]);
    expect(abbasidPlaces(835)).toEqual(["Baghdad"]);
    expect(abbasidPlaces(836)).toEqual(["Samarra"]);
    expect(abbasidPlaces(892)).toEqual(["Samarra"]);
    expect(abbasidPlaces(893)).toEqual(["Baghdad"]);

    const coverage = buildDataCoverageReport(data).temporalCoverage.polities.find(
      ({ entityId }) => entityId === "polity-abbasid-caliphate"
    )?.geography;
    expect(coverage?.coveredYears).toBe(497);
    expect(coverage?.unknownPeriods).toEqual([{ startYear: 750, endYear: 761 }]);
  });

  it("点位分别引用都城年份与具体遗产区坐标，不将单点解释为疆域", () => {
    const snapshot = data.geographicSnapshots.find(({ id }) => id === "geo-abbasid-samarra");
    expect(snapshot).toMatchObject({
      role: "capital",
      positionPrecision: "approximate",
      coordinates: { latitude: 34.226275, longitude: 43.882572 }
    });
    expect(snapshot?.positionNote).toMatch(/不表示.*政权疆域/);
    expect(snapshot?.sourceRefs.every(({ locator }) => Boolean(locator?.trim()))).toBe(true);
    const sources = snapshot?.sourceRefs.map(({ sourceId }) =>
      data.sources.find(({ id }) => id === sourceId)
    );
    expect(sources?.some((source) => source?.sourceType === "institutional")).toBe(true);
    expect(sources?.some((source) => source?.sourceType === "dataset")).toBe(true);
  });
});
