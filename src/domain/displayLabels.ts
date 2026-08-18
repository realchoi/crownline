import type {
  ConfidenceLevel,
  DisplayCategory,
  GeographicRole,
  PolityForm,
  ReignRole,
  RelationshipType
} from "./types";

/** Pure, exhaustive domain-to-Chinese-label mappings used by the UI. */
export const DISPLAY_CATEGORY_NAMES: Record<DisplayCategory, string> = {
  mainline: "主线王朝",
  contemporary: "主要并立政权",
  context: "历史分期",
  regional: "区域政权"
};

// Detail and comparison intentionally retain their established contextual wording.
export const DETAIL_POLITY_FORM_NAMES: Record<PolityForm, string> = {
  dynasty: "王朝",
  empire: "帝国",
  kingdom: "王国",
  khanate: "汗国",
  state: "政权",
  other: "其他"
};

export const COMPARISON_POLITY_FORM_NAMES: Record<PolityForm, string> = {
  dynasty: "王朝",
  empire: "帝国",
  kingdom: "王国",
  khanate: "汗国",
  state: "国家",
  other: "其他"
};

export const DETAIL_REIGN_ROLE_NAMES: Record<ReignRole, string> = {
  ruler: "在位者",
  "co-ruler": "共治者",
  regent: "摄政者",
  contender: "争位者"
};

export const COMPARISON_REIGN_ROLE_NAMES: Record<ReignRole, string> = {
  ruler: "统治者",
  "co-ruler": "共治者",
  regent: "摄政者",
  contender: "争位者"
};

export const DETAIL_CONFIDENCE_NAMES: Record<ConfidenceLevel, string> = {
  high: "较高",
  medium: "中等",
  low: "较低",
  disputed: "存在争议"
};

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  war: "战争",
  alliance: "联盟",
  diplomacy: "外交",
  tribute: "朝贡",
  vassalage: "臣属",
  trade: "贸易",
  "cultural-exchange": "文化交流"
};

export const RELATIONSHIP_CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "高可信度",
  medium: "中等可信度",
  low: "低可信度",
  disputed: "存在争议"
};

export const GEOGRAPHIC_ROLE_NAMES: Record<GeographicRole, string> = {
  capital: "都城",
  "political-center": "政治中心",
  "representative-center": "代表性中心"
};
