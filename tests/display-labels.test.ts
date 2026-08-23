import { describe, expect, it } from "vitest";

import {
  COMPARISON_POLITY_FORM_NAMES,
  COMPARISON_REIGN_ROLE_NAMES,
  BOUNDARY_PRECISION_NAMES,
  DETAIL_CONFIDENCE_NAMES,
  DETAIL_POLITY_FORM_NAMES,
  DETAIL_REIGN_ROLE_NAMES,
  DISPLAY_CATEGORY_NAMES,
  GEOGRAPHIC_ROLE_NAMES,
  RELATIONSHIP_CONFIDENCE_LABELS,
  RELATIONSHIP_TYPE_LABELS
} from "../src/domain/displayLabels";
import {
  CONFIDENCE_LEVELS,
  BOUNDARY_PRECISIONS,
  DISPLAY_CATEGORIES,
  GEOGRAPHIC_ROLES,
  POLITY_FORMS,
  REIGN_ROLES,
  RELATIONSHIP_TYPES
} from "../src/domain/types";

describe("界面领域标签", () => {
  it.each([
    [DISPLAY_CATEGORIES, DISPLAY_CATEGORY_NAMES],
    [POLITY_FORMS, DETAIL_POLITY_FORM_NAMES],
    [POLITY_FORMS, COMPARISON_POLITY_FORM_NAMES],
    [REIGN_ROLES, DETAIL_REIGN_ROLE_NAMES],
    [REIGN_ROLES, COMPARISON_REIGN_ROLE_NAMES],
    [CONFIDENCE_LEVELS, DETAIL_CONFIDENCE_NAMES],
    [BOUNDARY_PRECISIONS, BOUNDARY_PRECISION_NAMES],
    [CONFIDENCE_LEVELS, RELATIONSHIP_CONFIDENCE_LABELS],
    [RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABELS],
    [GEOGRAPHIC_ROLES, GEOGRAPHIC_ROLE_NAMES]
  ] as const)("为每个领域枚举值提供非空标签", (values, labels) => {
    const allLabels = labels as Record<string, string>;
    expect(values.every((value) => allLabels[value]!.length > 0)).toBe(true);
    expect(Object.keys(labels)).toHaveLength(values.length);
  });

  it("保留详情与对比语境中既有的不同措辞", () => {
    expect(DETAIL_POLITY_FORM_NAMES.state).toBe("政权");
    expect(COMPARISON_POLITY_FORM_NAMES.state).toBe("国家");
    expect(DETAIL_REIGN_ROLE_NAMES.ruler).toBe("在位者");
    expect(COMPARISON_REIGN_ROLE_NAMES.ruler).toBe("统治者");
  });
});
