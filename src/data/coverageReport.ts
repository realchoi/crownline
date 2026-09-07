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
import {
  buildPolityTemporalCoverage,
  type PolityTemporalCoverage
} from "../domain/temporalCoverage";

import {
  summarizeBoundaryEvidenceReview,
  type BoundaryEvidenceSummary,
  type LoadedBoundaryEvidenceReview
} from "./boundaryEvidenceReview";

export const DATA_COVERAGE_REPORT_VERSION = 3 as const;

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
  boundarySnapshots: SourceReferenceQuality;
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

export interface TemporalCoverageSummary {
  polities: number;
  totalExistenceYears: number;
  rulerCoveredYears: number;
  anyReignYears: number;
  yearsWithoutReignRecords: number;
  politiesWithYearsWithoutReignRecords: number;
  explicitVacancyYears: number;
  documentedRulerOrVacancyYears: number;
  unknownRulerYears: number;
  rulerCoveragePercentage: number;
  documentedRulerOrVacancyPercentage: number;
  politiesWithUnknownRulerYears: number;
  geographyCoveredYears: number;
  unknownGeographyYears: number;
  geographyCoveragePercentage: number;
  politiesWithUnknownGeographyYears: number;
}

export interface TemporalCoverageReport {
  definitions: {
    intervalSemantics: string;
    rulerCoverage: string;
    anyReignCoverage: string;
    explicitVacancy: string;
    unknownRulerCoverage: string;
    geographyCoverage: string;
  };
  summary: TemporalCoverageSummary;
  polities: PolityTemporalCoverage[];
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
    boundarySnapshots: number;
    sources: number;
  };
  polityCoverage: PolityCoverageMetrics;
  reviewableGaps: ReviewableGaps;
  relationshipSummary: RelationshipCoverageSummary;
  sourceQuality: SourceQualitySummary;
  sourceReferenceQuality: SourceReferenceQualitySummary;
  temporalCoverage: TemporalCoverageReport;
  boundaryEvidence: BoundaryEvidenceSummary | null;
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

function buildTemporalCoverage(
  data: CrownlineData,
  polities: readonly HistoricalEntity[]
): TemporalCoverageReport {
  const polityCoverage = [...polities]
    .sort((left, right) => compareIds(left.id, right.id))
    .map((polity) => {
      return buildPolityTemporalCoverage(
        polity,
        data.reigns,
        data.reignVacancies,
        data.geographicSnapshots
      );
    });
  const totalExistenceYears = polityCoverage.reduce(
    (total, polity) => total + polity.totalExistenceYears,
    0
  );
  const rulerCoveredYears = polityCoverage.reduce(
    (total, polity) => total + polity.rulerDetails.rulerCoveredYears,
    0
  );
  const anyReignYears = polityCoverage.reduce(
    (total, polity) => total + polity.rulerDetails.anyReignYears,
    0
  );
  const explicitVacancyYears = polityCoverage.reduce(
    (total, polity) => total + polity.rulerDetails.explicitVacancyYears,
    0
  );
  const documentedRulerOrVacancyYears = polityCoverage.reduce(
    (total, polity) => total + polity.rulerDetails.documentedYears,
    0
  );
  const unknownRulerYears = polityCoverage.reduce(
    (total, polity) => total + polity.rulerDetails.unknownYears,
    0
  );
  const geographyCoveredYears = polityCoverage.reduce(
    (total, polity) => total + polity.geography.coveredYears,
    0
  );
  const unknownGeographyYears = polityCoverage.reduce(
    (total, polity) => total + polity.geography.unknownYears,
    0
  );

  return {
    definitions: {
      intervalSemantics:
        "按源数据采用年代计算闭区间，约年与争议不因此成为精确历史事实；负数为公元前，正数为公元后，不存在公元 0 年。跨政权累计的是政权年，不是全球不重复年份。",
      rulerCoverage: "仅 ruler 与 co-ruler 角色的任期计入正式统治者任期覆盖；重叠年份只计一次。",
      anyReignCoverage: "所有任期角色（含摄政与争位者）的记录并集，仅表示已有任期类资料。",
      explicitVacancy: "仅有来源明确支持的 reignVacancies 计为明确空位。",
      unknownRulerCoverage:
        "政权存续期扣除正式统治者任期与明确空位后的年份；摄政或争位记录本身不会消除此未知状态。",
      geographyCoverage: "存在适用地理快照的年份；点位仅表示都城、政治中心或浏览定位，不表示疆域。"
    },
    summary: {
      polities: polityCoverage.length,
      totalExistenceYears,
      rulerCoveredYears,
      anyReignYears,
      yearsWithoutReignRecords: totalExistenceYears - anyReignYears,
      politiesWithYearsWithoutReignRecords: polityCoverage.filter(
        ({ totalExistenceYears, rulerDetails }) => rulerDetails.anyReignYears < totalExistenceYears
      ).length,
      explicitVacancyYears,
      documentedRulerOrVacancyYears,
      unknownRulerYears,
      rulerCoveragePercentage: percentage(rulerCoveredYears, totalExistenceYears),
      documentedRulerOrVacancyPercentage: percentage(
        documentedRulerOrVacancyYears,
        totalExistenceYears
      ),
      politiesWithUnknownRulerYears: polityCoverage.filter(
        ({ rulerDetails }) => rulerDetails.unknownYears > 0
      ).length,
      geographyCoveredYears,
      unknownGeographyYears,
      geographyCoveragePercentage: percentage(geographyCoveredYears, totalExistenceYears),
      politiesWithUnknownGeographyYears: polityCoverage.filter(
        ({ geography }) => geography.unknownYears > 0
      ).length
    },
    polities: polityCoverage
  };
}

/** 生成覆盖报告 v3；报告只供数据治理工具使用，不属于浏览器运行时契约。 */
export function buildDataCoverageReport(
  data: CrownlineData,
  coverageReview: CoverageReviewData = { entries: [] },
  boundaryEvidence?: LoadedBoundaryEvidenceReview
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
      boundarySnapshots: data.boundarySnapshots.length,
      sources: data.sources.length
    },
    polityCoverage: buildPolityCoverage(data, polities, reviewByKey),
    reviewableGaps: buildReviewableGaps(data, polities, reviewByKey),
    relationshipSummary,
    sourceQuality: buildSourceQuality(data),
    sourceReferenceQuality: {
      relationships: sourceReferenceQuality(data.relationships),
      events: sourceReferenceQuality(data.events),
      geographicSnapshots: sourceReferenceQuality(data.geographicSnapshots),
      boundarySnapshots: sourceReferenceQuality(data.boundarySnapshots)
    },
    temporalCoverage: buildTemporalCoverage(data, polities),
    boundaryEvidence: boundaryEvidence
      ? summarizeBoundaryEvidenceReview(boundaryEvidence, data.boundarySnapshots)
      : null,
    topLevelRegions
  };
}
