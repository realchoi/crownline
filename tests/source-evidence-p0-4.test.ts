import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";

const data = await loadSourceData();

describe("东吴武昌点位证据校订", () => {
  it("把孙权时期武昌定位到鄂州，并保留两次有据可查的政治中心时期", () => {
    const snapshot = data.geographicSnapshots.find(({ id }) => id === "geo-eastern-wu-wuchang");
    expect(snapshot).toBeDefined();
    expect(snapshot?.coordinates.latitude).toBeCloseTo(30.4, 2);
    expect(snapshot?.coordinates.longitude).toBeCloseTo(114.88, 2);
    expect(snapshot?.periods).toEqual([
      { start: { year: 222, precision: "exact" }, end: { year: 229, precision: "exact" } },
      { start: { year: 265, precision: "exact" }, end: { year: 266, precision: "exact" } }
    ]);
    expect(snapshot?.sourceRefs.every(({ locator }) => Boolean(locator?.trim()))).toBe(true);
    expect(snapshot?.sourceRefs.some(({ sourceId }) => sourceId === "source-geonames")).toBe(false);
  });
});
