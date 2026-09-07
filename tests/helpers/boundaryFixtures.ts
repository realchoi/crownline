import { CROWNLINE_SCHEMA_VERSION, type CrownlineBoundaries } from "../../src/domain/types";

/** Synthetic rectangles for rendering tests only; these are not historical reconstructions. */
export function createBoundaryFixture(): CrownlineBoundaries {
  return {
    schemaVersion: CROWNLINE_SCHEMA_VERSION,
    sources: [
      {
        id: "source-synthetic-boundary-test",
        title: "Synthetic geometry fixture",
        sourceType: "dataset",
        citation: "Test-only rectangles; no historical or upstream data claim."
      }
    ],
    boundarySnapshots: [
      { polityId: "polity-abbasid-caliphate", start: 750, end: 861, longitude: 40 },
      { polityId: "polity-byzantine-empire", start: 800, end: 1025, longitude: 20 }
    ].map(({ polityId, start, end, longitude }) => ({
      id: `boundary-test-${polityId}-${start}-${end}`,
      polityId,
      periods: [
        {
          start: { year: start, precision: "exact" },
          end: { year: end, precision: "exact" }
        }
      ],
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [longitude, 30],
              [longitude + 10, 30],
              [longitude + 10, 40],
              [longitude, 40],
              [longitude, 30]
            ]
          ]
        ]
      },
      boundaryPrecision: "schematic",
      boundaryNote: "Synthetic test geometry; not historical evidence.",
      sourceRefs: [{ sourceId: "source-synthetic-boundary-test", locator: "Fixture rectangles" }],
      provenance: {
        datasetTitle: "Synthetic geometry fixture",
        attribution: "Crownline tests",
        licenseName: "Test fixture",
        licenseUrl: "https://example.test/license",
        sourceUrl: "https://example.test/rectangles",
        derivedFrom: "Hand-authored test rectangles, not an upstream historical dataset.",
        processingNote: "No historical reconstruction or coordinate derivation."
      },
      confidence: "low",
      confidenceNote: "Test-only shape; not a claim about a historical polity."
    }))
  };
}

export async function loadBoundaryFixture() {
  return { boundaries: createBoundaryFixture(), omittedCount: 0 };
}
