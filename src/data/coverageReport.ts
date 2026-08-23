import {
  CONFIDENCE_LEVELS,
  RELATIONSHIP_TYPES,
  SOURCE_TYPES,
  type ConfidenceLevel,
  type CrownlineData,
  type HistoricalEntity,
  type Region,
  type RelationshipType,
  type SourceRef,
  type SourceType,
  type RegionCoverageStatus
} from "../domain/types";
import {
  isCoverageDimensionAvailable,
  validateCoverageReviewData,
  type CoverageReviewData,
  type CoverageReviewDimension,
  type CoverageReviewStatus
} from "./coverageReview";

export const DATA_COVERAGE_REPORT_VERSION = 2 as const;

export interface ReviewableCoverageMetric {
  total: number;
  available: number;
  reviewedUnavailable: number;
  notApplicable: number;
  pendingReview: number;
  applicableTotal: number;
  availablePercentage: number;
  reviewedPercentage: number;
}

export interface PolityCoverageMetrics {
  rulerDetails: ReviewableCoverageMetric;
  localNames: ReviewableCoverageMetric;
  geography: ReviewableCoverageMetric;
}

export interface RelationshipCoverageSummary {
  records: number;
  participantPolities: number;
  totalPolities: number;
  participantPercentage: number;
  byType: Record<RelationshipType, number>;
  byConfidence: Record<ConfidenceLevel, number>;
  regionsWithRecords: string[];
  regionsWithoutRecords: string[];
}

export interface SourceQualitySummary {
  total: number;
  byType: Record<SourceType, number>;
  withUrl: number;
  withoutUrl: number;
  withAccessedAt: number;
  withoutAccessedAt: number;
}

export interface SourceReferenceQuality {
  records: number;
  recordsWithSourceRefs: number;
  recordsWithLocatedSourceRefs: number;
  recordsWithoutLocatedSourceRefs: number;
}

export interface SourceReferenceQualitySummary {
  relationships: SourceReferenceQuality;
  events: SourceReferenceQuality;
  geographicSnapshots: SourceReferenceQuality;
}

export interface RegionDataCoverage {
  regionId: string;
  name: string;
  coverageStatus: RegionCoverageStatus;
  directPolityCount: number;
  polityCountIncludingDescendants: number;
  coverage: PolityCoverageMetrics;
  relationshipSummary: RelationshipCoverageSummary;
}

export interface ReviewableGapStatuses {
  reviewedUnavailable: string[];
  notApplicable: string[];
  pendingReview: string[];
}

export type ReviewableGaps = Record<CoverageReviewDimension, ReviewableGapStatuses>;

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
  reviewableGaps: ReviewableGaps;
  relationshipSummary: RelationshipCoverageSummary;
  sourceQuality: SourceQualitySummary;
  sourceReferenceQuality: SourceReferenceQualitySummary;
  topLevelRegions: RegionDataCoverage[];
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function percentage(covered: number, total: number): number {
  return total === 0 ? 0 : Number(((covered / total) * 100).toFixed(2));
}

function zeroCounts<const T extends readonly string[]>(keys: T): Record<T[number], number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T[number], number>;
}

function reviewStatusFor(
  data: CrownlineData,
  polity: HistoricalEntity,
  dimension: CoverageReviewDimension,
  reviewByKey: ReadonlyMap<string, CoverageReviewStatus>
): CoverageReviewStatus {
  if (isCoverageDimensionAvailable(data, polity, dimension)) return "available";
  return reviewByKey.get(`${polity.id}\u0000${dimension}`) ?? "pending-review";
}

function buildReviewableMetric(
  data: CrownlineData,
  polities: readonly HistoricalEntity[],
  dimension: CoverageReviewDimension,
  reviewByKey: ReadonlyMap<string, CoverageReviewStatus>
): ReviewableCoverageMetric {
  const counts: Record<CoverageReviewStatus, number> = {
    available: 0,
    "reviewed-unavailable": 0,
    "not-applicable": 0,
    "pending-review": 0
  };
  [...polities]
    .sort((left, right) => compareIds(left.id, right.id))
    .forEach((polity) => {
      counts[reviewStatusFor(data, polity, dimension, reviewByKey)] += 1;
    });
  const applicableTotal = polities.length - counts["not-applicable"];
  return {
    total: polities.length,
    available: counts.available,
    reviewedUnavailable: counts["reviewed-unavailable"],
    notApplicable: counts["not-applicable"],
    pendingReview: counts["pending-review"],
    applicableTotal,
    availablePercentage: percentage(counts.available, applicableTotal),
    reviewedPercentage: percentage(polities.length - counts["pending-review"], polities.length)
  };
}

function buildPolityCoverage(
  data: CrownlineData,
  polities: readonly HistoricalEntity[],
  reviewByKey: ReadonlyMap<string, CoverageReviewStatus>
): PolityCoverageMetrics {
  return {
    rulerDetails: buildReviewableMetric(data, polities, "rulerDetails", reviewByKey),
    localNames: buildReviewableMetric(data, polities, "localNames", reviewByKey),
    geography: buildReviewableMetric(data, polities, "geography", reviewByKey)
  };
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

function buildReviewableGaps(
  data: CrownlineData,
  polities: readonly HistoricalEntity[],
  reviewByKey: ReadonlyMap<string, CoverageReviewStatus>
): ReviewableGaps {
  const dimensions: CoverageReviewDimension[] = ["rulerDetails", "localNames", "geography"];
  return Object.fromEntries(
    dimensions.map((dimension) => {
      const statuses: ReviewableGapStatuses = {
        reviewedUnavailable: [],
        notApplicable: [],
        pendingReview: []
      };
      [...polities]
        .sort((left, right) => compareIds(left.id, right.id))
        .forEach((polity) => {
          const status = reviewStatusFor(data, polity, dimension, reviewByKey);
          if (status === "reviewed-unavailable") statuses.reviewedUnavailable.push(polity.id);
          if (status === "not-applicable") statuses.notApplicable.push(polity.id);
          if (status === "pending-review") statuses.pendingReview.push(polity.id);
        });
      return [dimension, statuses];
    })
  ) as ReviewableGaps;
}

function buildRelationshipSummary(
  relationships: CrownlineData["relationships"],
  polities: readonly HistoricalEntity[],
  regionsWithRecords: string[],
  regionsWithoutRecords: string[]
): RelationshipCoverageSummary {
  const polityIds = new Set(polities.map(({ id }) => id));
  const participantIds = new Set(
    relationships.flatMap(({ participants }) =>
      participants.flatMap(({ entityId }) => (polityIds.has(entityId) ? [entityId] : []))
    )
  );
  const byType = zeroCounts(RELATIONSHIP_TYPES);
  const byConfidence = zeroCounts(CONFIDENCE_LEVELS);
  relationships.forEach((relationship) => {
    byType[relationship.type] += 1;
    byConfidence[relationship.confidence] += 1;
  });
  return {
    records: relationships.length,
    participantPolities: participantIds.size,
    totalPolities: polities.length,
    participantPercentage: percentage(participantIds.size, polities.length),
    byType,
    byConfidence,
    regionsWithRecords: [...regionsWithRecords],
    regionsWithoutRecords: [...regionsWithoutRecords]
  };
}

function sourceReferenceQuality(
  records: ReadonlyArray<{ sourceRefs: readonly SourceRef[] }>
): SourceReferenceQuality {
  const recordsWithSourceRefs = records.filter(({ sourceRefs }) => sourceRefs.length > 0).length;
  const recordsWithLocatedSourceRefs = records.filter(({ sourceRefs }) => {
    return sourceRefs.some(({ locator }) => {
      return typeof locator === "string" && locator.trim().length > 0;
    });
  }).length;
  return {
    records: records.length,
    recordsWithSourceRefs,
    recordsWithLocatedSourceRefs,
    recordsWithoutLocatedSourceRefs: records.length - recordsWithLocatedSourceRefs
  };
}

function buildSourceQuality(data: CrownlineData): SourceQualitySummary {
  const byType = zeroCounts(SOURCE_TYPES);
  let withUrl = 0;
  let withAccessedAt = 0;
  data.sources.forEach((source) => {
    byType[source.sourceType] += 1;
    if (source.url?.trim().length) withUrl += 1;
    if (source.accessedAt?.trim().length) withAccessedAt += 1;
  });
  return {
    total: data.sources.length,
    byType,
    withUrl,
    withoutUrl: data.sources.length - withUrl,
    withAccessedAt,
    withoutAccessedAt: data.sources.length - withAccessedAt
  };
}

function throwIfInvalidReview(data: CrownlineData, review: CoverageReviewData): void {
  const result = validateCoverageReviewData(review, data);
  if (!result.valid) {
    const details = result.issues
      .map((issue) => `[${issue.code}] ${issue.path} ${issue.message}`)
      .join("\n");
    throw new Error(`coverage review validation failed:\n${details}`);
  }
}

/** 生成覆盖报告 v2；报告只供数据治理工具使用，不属于浏览器运行时契约。 */
export function buildDataCoverageReport(
  data: CrownlineData,
  coverageReview: CoverageReviewData = { entries: [] }
): DataCoverageReport {
  throwIfInvalidReview(data, coverageReview);
  const polities = data.entities.filter(({ entityKind }) => entityKind === "polity");
  const reviewByKey = new Map(
    coverageReview.entries.map((entry) => [
      `${entry.entityId}\u0000${entry.dimension}`,
      entry.status
    ])
  );
  const topLevelRegionDefinitions = data.regions.filter(({ regionKind, parentRegionId }) => {
    return regionKind === "historical-region" && parentRegionId === undefined;
  });
  const regionPolities = topLevelRegionDefinitions.map((region) => {
    const descendantIds = collectDescendantRegionIds(region, data.regions);
    return polities.filter(({ historicalRegionIds }) => {
      return historicalRegionIds.some((regionId) => descendantIds.has(regionId));
    });
  });
  const regionsWithRecords = topLevelRegionDefinitions.flatMap((region, index) => {
    const scopedPolityIds = new Set(regionPolities[index]?.map(({ id }) => id) ?? []);
    return data.relationships.some(({ participants }) => {
      return participants.some(({ entityId }) => scopedPolityIds.has(entityId));
    })
      ? [region.id]
      : [];
  });
  const regionsWithoutRecords = topLevelRegionDefinitions
    .map(({ id }) => id)
    .filter((id) => !regionsWithRecords.includes(id));
  const relationshipSummary = buildRelationshipSummary(
    data.relationships,
    polities,
    regionsWithRecords,
    regionsWithoutRecords
  );
  const topLevelRegions = topLevelRegionDefinitions.map((region, index): RegionDataCoverage => {
    const scopedPolities = regionPolities[index] ?? [];
    const scopedPolityIds = new Set(scopedPolities.map(({ id }) => id));
    const scopedRelationships = data.relationships.filter(({ participants }) => {
      return participants.some(({ entityId }) => scopedPolityIds.has(entityId));
    });
    return {
      regionId: region.id,
      name: region.names.primary,
      coverageStatus: region.coverage.status,
      directPolityCount: polities.filter(({ historicalRegionIds }) => {
        return historicalRegionIds.includes(region.id);
      }).length,
      polityCountIncludingDescendants: scopedPolities.length,
      coverage: buildPolityCoverage(data, scopedPolities, reviewByKey),
      relationshipSummary: buildRelationshipSummary(
        scopedRelationships,
        scopedPolities,
        scopedRelationships.length > 0 ? [region.id] : [],
        scopedRelationships.length > 0 ? [] : [region.id]
      )
    };
  });

  return {
    reportVersion: DATA_COVERAGE_REPORT_VERSION,
    dataSchemaVersion: data.schemaVersion,
    totals: {
      entities: data.entities.length,
      polities: polities.length,
      historicalPeriods: data.entities.filter(
        ({ entityKind }) => entityKind === "historical-period"
      ).length,
      persons: data.persons.length,
      reigns: data.reigns.length,
      reignVacancies: data.reignVacancies.length,
      relationships: data.relationships.length,
      events: data.events.length,
      geographicSnapshots: data.geographicSnapshots.length,
      sources: data.sources.length
    },
    polityCoverage: buildPolityCoverage(data, polities, reviewByKey),
    reviewableGaps: buildReviewableGaps(data, polities, reviewByKey),
    relationshipSummary,
    sourceQuality: buildSourceQuality(data),
    sourceReferenceQuality: {
      relationships: sourceReferenceQuality(data.relationships),
      events: sourceReferenceQuality(data.events),
      geographicSnapshots: sourceReferenceQuality(data.geographicSnapshots)
    },
    topLevelRegions
  };
}
