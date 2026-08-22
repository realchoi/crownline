import type {
  CrownlineData,
  HistoricalEntity,
  Region,
  RegionCoverageStatus
} from "../domain/types";

export const DATA_COVERAGE_REPORT_VERSION = 1;

export interface CoverageMetric {
  covered: number;
  total: number;
  percentage: number;
}

export interface PolityCoverageMetrics {
  rulerDetails: CoverageMetric;
  localNames: CoverageMetric;
  geography: CoverageMetric;
  relationships: CoverageMetric;
}

export interface RegionDataCoverage {
  regionId: string;
  name: string;
  coverageStatus: RegionCoverageStatus;
  directPolityCount: number;
  polityCountIncludingDescendants: number;
  coverage: PolityCoverageMetrics;
}

export interface DataCoverageReport {
  reportVersion: typeof DATA_COVERAGE_REPORT_VERSION;
  dataSchemaVersion: CrownlineData["schemaVersion"];
  totals: {
    entities: number;
    polities: number;
    historicalPeriods: number;
    persons: number;
    reigns: number;
    reignVacancies: number;
    relationships: number;
    events: number;
    geographicSnapshots: number;
    sources: number;
  };
  polityCoverage: PolityCoverageMetrics;
  polityGaps: {
    rulerDetails: string[];
    localNames: string[];
    geography: string[];
    relationships: string[];
  };
  topLevelRegions: RegionDataCoverage[];
}

function percentage(covered: number, total: number): number {
  return total === 0 ? 0 : Number(((covered / total) * 100).toFixed(2));
}

function metric(polities: readonly HistoricalEntity[], coveredIds: ReadonlySet<string>) {
  const covered = polities.filter(({ id }) => coveredIds.has(id)).length;
  return { covered, total: polities.length, percentage: percentage(covered, polities.length) };
}

function missingIds(polities: readonly HistoricalEntity[], coveredIds: ReadonlySet<string>) {
  return polities.flatMap(({ id }) => (coveredIds.has(id) ? [] : [id]));
}

function collectDescendantRegionIds(region: Region, regions: readonly Region[]): Set<string> {
  const ids = new Set([region.id]);
  let added = true;
  while (added) {
    added = false;
    regions.forEach((candidate) => {
      if (candidate.parentRegionId && ids.has(candidate.parentRegionId) && !ids.has(candidate.id)) {
        ids.add(candidate.id);
        added = true;
      }
    });
  }
  return ids;
}

function buildPolityCoverage(
  polities: readonly HistoricalEntity[],
  rulerDetailIds: ReadonlySet<string>,
  localNameIds: ReadonlySet<string>,
  mappedIds: ReadonlySet<string>,
  relationshipIds: ReadonlySet<string>
): PolityCoverageMetrics {
  return {
    rulerDetails: metric(polities, rulerDetailIds),
    localNames: metric(polities, localNameIds),
    geography: metric(polities, mappedIds),
    relationships: metric(polities, relationshipIds)
  };
}

/** 生成扩容验收使用的确定性数据覆盖报告。 */
export function buildDataCoverageReport(data: CrownlineData): DataCoverageReport {
  const polities = data.entities.filter(({ entityKind }) => entityKind === "polity");
  const personIds = new Set(data.persons.map(({ id }) => id));
  const reignsByPolityId = new Map<string, CrownlineData["reigns"]>();
  data.reigns.forEach((reign) => {
    const reigns = reignsByPolityId.get(reign.polityId) ?? [];
    reigns.push(reign);
    reignsByPolityId.set(reign.polityId, reigns);
  });
  const rulerDetailIds = new Set(
    polities.flatMap(({ id }) => {
      const reigns = reignsByPolityId.get(id) ?? [];
      return reigns.length > 0 && reigns.every(({ personId }) => personIds.has(personId))
        ? [id]
        : [];
    })
  );
  const localNameIds = new Set(
    polities.flatMap(({ id, names }) => (names.local && names.localLanguageTag ? [id] : []))
  );
  const mappedIds = new Set(data.geographicSnapshots.map(({ polityId }) => polityId));
  const relationshipIds = new Set(
    data.relationships.flatMap(({ participants }) => participants.map(({ entityId }) => entityId))
  );
  const topLevelRegions = data.regions
    .filter(({ regionKind, parentRegionId }) => {
      return regionKind === "historical-region" && parentRegionId === undefined;
    })
    .map((region): RegionDataCoverage => {
      const descendantIds = collectDescendantRegionIds(region, data.regions);
      const regionPolities = polities.filter(({ historicalRegionIds }) => {
        return historicalRegionIds.some((regionId) => descendantIds.has(regionId));
      });
      return {
        regionId: region.id,
        name: region.names.primary,
        coverageStatus: region.coverage.status,
        directPolityCount: polities.filter(({ historicalRegionIds }) => {
          return historicalRegionIds.includes(region.id);
        }).length,
        polityCountIncludingDescendants: regionPolities.length,
        coverage: buildPolityCoverage(
          regionPolities,
          rulerDetailIds,
          localNameIds,
          mappedIds,
          relationshipIds
        )
      };
    });

  return {
    reportVersion: DATA_COVERAGE_REPORT_VERSION,
    dataSchemaVersion: data.schemaVersion,
    totals: {
      entities: data.entities.length,
      polities: polities.length,
      historicalPeriods: data.entities.length - polities.length,
      persons: data.persons.length,
      reigns: data.reigns.length,
      reignVacancies: data.reignVacancies.length,
      relationships: data.relationships.length,
      events: data.events.length,
      geographicSnapshots: data.geographicSnapshots.length,
      sources: data.sources.length
    },
    polityCoverage: buildPolityCoverage(
      polities,
      rulerDetailIds,
      localNameIds,
      mappedIds,
      relationshipIds
    ),
    polityGaps: {
      rulerDetails: missingIds(polities, rulerDetailIds),
      localNames: missingIds(polities, localNameIds),
      geography: missingIds(polities, mappedIds),
      relationships: missingIds(polities, relationshipIds)
    },
    topLevelRegions
  };
}
