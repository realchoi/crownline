/** 数据契约允许使用的年代精度。 */
export const DATE_PRECISIONS = ["exact", "circa", "decade", "century", "unknown"] as const;
/** 区分真实政治实体与仅用于展示的历史分期。 */
export const ENTITY_KINDS = ["polity", "historical-period"] as const;
/** 政治实体的形态；不参与页面视觉层级判断。 */
export const POLITY_FORMS = ["dynasty", "empire", "kingdom", "khanate", "state", "other"] as const;
/** 当前时间轴采用的展示层级。 */
export const DISPLAY_CATEGORIES = ["mainline", "contemporary", "regional", "context"] as const;
/** 当前采用年代是否存在需要披露的争议。 */
export const CHRONOLOGY_STATUSES = ["accepted", "disputed"] as const;
/** 记录整体可信度，用于驱动说明与后续界面提示。 */
export const CONFIDENCE_LEVELS = ["high", "medium", "low", "disputed"] as const;
/** 历史地区、文化圈和现代地理映射必须分别建模。 */
export const REGION_KINDS = ["historical-region", "cultural-sphere", "modern-area"] as const;
/** 地区数据覆盖只描述当前数据集，不评价真实历史完整性。 */
export const REGION_COVERAGE_STATUSES = ["none", "sample", "partial"] as const;
/** 人物在某段任期内扮演的统治角色。 */
export const REIGN_ROLES = ["ruler", "co-ruler", "regent", "contender"] as const;
/** 首批支持的结构化政权关系类型。 */
export const RELATIONSHIP_TYPES = [
  "war",
  "alliance",
  "diplomacy",
  "tribute",
  "vassalage",
  "trade",
  "cultural-exchange"
] as const;
/** 可挂接到政权或关系上的结构化事件类型。 */
export const EVENT_TYPES = [
  "foundation",
  "dissolution",
  "succession",
  "battle",
  "treaty",
  "diplomatic",
  "other"
] as const;
/** 来源的资料层级或载体类别。 */
export const SOURCE_TYPES = [
  "primary",
  "secondary",
  "tertiary",
  "dataset",
  "institutional"
] as const;
/** 历史点位在对应时期承担的空间角色。 */
export const GEOGRAPHIC_ROLES = ["capital", "political-center", "representative-center"] as const;
/** 历史地点映射到现代坐标时的定位精度。 */
export const POSITION_PRECISIONS = ["exact", "approximate", "regional"] as const;

export type DatePrecision = (typeof DATE_PRECISIONS)[number];
export type EntityKind = (typeof ENTITY_KINDS)[number];
export type PolityForm = (typeof POLITY_FORMS)[number];
export type DisplayCategory = (typeof DISPLAY_CATEGORIES)[number];
export type ChronologyStatus = (typeof CHRONOLOGY_STATUSES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type RegionKind = (typeof REGION_KINDS)[number];
export type RegionCoverageStatus = (typeof REGION_COVERAGE_STATUSES)[number];
export type ReignRole = (typeof REIGN_ROLES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type GeographicRole = (typeof GEOGRAPHIC_ROLES)[number];
export type PositionPrecision = (typeof POSITION_PRECISIONS)[number];

/**
 * 不含公元 0 年的历史日期。
 * 负数表示公元前，正数表示公元后。
 */
export interface HistoricalDate {
  year: number;
  precision: DatePrecision;
}

/** 两端都包含的历史时间区间。 */
export interface HistoricalInterval {
  start: HistoricalDate;
  end: HistoricalDate;
}

/** 实体或人物的主名称、别名与可选本地名称；本地名称必须携带 BCP 47 语言标签。 */
export interface LocalizedNames {
  primary: string;
  aliases: string[];
  local?: string;
  localLanguageTag?: string;
}

/** 指向集中来源表的引用，可进一步精确到页码或章节。 */
export interface SourceRef {
  sourceId: string;
  locator?: string;
  note?: string;
}

/** 与当前采用年代并存的替代史学口径。 */
export interface AlternativeChronology {
  label: string;
  existencePeriods: HistoricalInterval[];
  note: string;
  sourceRefs: SourceRef[];
}

/**
 * 时间轴中的历史实体。
 * `entityKind` 表达实体本质，`displayCategory` 只控制当前界面的展示层级。
 */
export interface HistoricalEntity {
  id: string;
  entityKind: EntityKind;
  polityForms: PolityForm[];
  displayCategory: DisplayCategory;
  names: LocalizedNames;
  existencePeriods: HistoricalInterval[];
  chronologyStatus: ChronologyStatus;
  chronologyNote?: string;
  alternativeChronologies?: AlternativeChronology[];
  displayRangeOverride?: string;
  historicalRegionIds: string[];
  culturalSphereIds: string[];
  modernAreaIds: string[];
  description: string;
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}

/** 时间轴的局部历史阶段及其展示范围。 */
export interface TimelineSection {
  id: string;
  title: string;
  displayRange: string;
  range: {
    startYear: number;
    endYear: number;
  };
  entityIds: string[];
}

/** 可被历史实体引用的地区、文化圈或现代地理映射。 */
export interface Region {
  id: string;
  names: LocalizedNames;
  regionKind: RegionKind;
  parentRegionId?: string;
  coverage: {
    status: RegionCoverageStatus;
    note: string;
  };
  description: string;
  sourceRefs: SourceRef[];
}

/** 独立于任期保存的历史人物资料。 */
export interface Person {
  id: string;
  names: LocalizedNames;
  description: string;
  sourceRefs: SourceRef[];
}

/** 人物在某一政权内一个或多个不连续的统治任期。 */
export interface Reign {
  id: string;
  personId: string;
  polityId: string;
  titles: string[];
  localTitles?: string[];
  role: ReignRole;
  periods: HistoricalInterval[];
  chronologyStatus: ChronologyStatus;
  note?: string;
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}

/** 有来源明确支持的无在位统治者时段；没有此记录的任期空档仍表示资料未收录。 */
export interface ReignVacancy {
  id: string;
  polityId: string;
  periods: HistoricalInterval[];
  note: string;
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}

/** 一条历史关系中的参与实体及其语义角色。 */
export interface RelationshipParticipant {
  entityId: string;
  role: string;
}

/** 有来源支持的政权间结构化历史关系。 */
export interface Relationship {
  id: string;
  type: RelationshipType;
  participants: RelationshipParticipant[];
  periods: HistoricalInterval[];
  summary: string;
  eventIds: string[];
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}

/** 可连接政权、地区和历史关系的结构化事件。 */
export interface HistoricalEvent {
  id: string;
  type: EventType;
  title: string;
  periods: HistoricalInterval[];
  participantEntityIds: string[];
  regionIds: string[];
  summary: string;
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}

/** WGS 84 十进制度坐标，仅用于历史地点示意。 */
export interface GeographicCoordinates {
  latitude: number;
  longitude: number;
}

/** 一处带适用时间、精度说明和来源的政权地理点位。 */
export interface GeographicSnapshot {
  id: string;
  polityId: string;
  periods: HistoricalInterval[];
  placeName: string;
  role: GeographicRole;
  coordinates: GeographicCoordinates;
  positionPrecision: PositionPrecision;
  positionNote: string;
  sourceRefs: SourceRef[];
  confidence: ConfidenceLevel;
  confidenceNote?: string;
}

/** 集中管理的可追溯资料来源。 */
export interface Source {
  id: string;
  title: string;
  sourceType: SourceType;
  citation: string;
  authors?: string[];
  publisher?: string;
  url?: string;
  accessedAt?: string;
}

/** 全数据集统一遵循的纪年和区间判定规则。 */
export interface ChronologyPolicy {
  calendar: "historical-year";
  hasYearZero: false;
  intervalBoundary: "inclusive";
  yearSelection: "exists-at-any-time-during-year";
}

/** Crownline 数据契约 v4 的根对象。 */
export interface CrownlineData {
  schemaVersion: 4;
  chronologyPolicy: ChronologyPolicy;
  timelineSections: TimelineSection[];
  entities: HistoricalEntity[];
  regions: Region[];
  persons: Person[];
  reigns: Reign[];
  reignVacancies: ReignVacancy[];
  relationships: Relationship[];
  events: HistoricalEvent[];
  geographicSnapshots: GeographicSnapshot[];
  sources: Source[];
}

/** 首屏浏览所需的轻量数据；人物、任期和来源在详情打开时加载。 */
export interface CrownlineIndex {
  schemaVersion: 4;
  chronologyPolicy: ChronologyPolicy;
  timelineSections: TimelineSection[];
  entities: HistoricalEntity[];
  regions: Region[];
  detailEntityIds: string[];
}

/** 一个实体可独立加载的引用闭包。 */
export interface CrownlineDetail {
  schemaVersion: 4;
  entityId: string;
  persons: Person[];
  reigns: Reign[];
  reignVacancies: ReignVacancy[];
  relationships: Relationship[];
  events: HistoricalEvent[];
  sources: Source[];
}

/** 地图首次打开时按需加载的地理快照及其来源闭包。 */
export interface CrownlineGeography {
  schemaVersion: 4;
  geographicSnapshots: GeographicSnapshot[];
  sources: Source[];
}

/** 搜索、筛选和时间轴共同依赖的最窄数据边界。 */
export type BrowseData = Pick<CrownlineIndex, "timelineSections" | "entities" | "regions">;
