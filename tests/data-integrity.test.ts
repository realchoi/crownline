import { describe, expect, it } from "vitest";

import dataJson from "../src/data/crownline-data.json";
import { loadCrownlineData } from "../src/data/loadCrownlineData";
import { isYearInPeriods } from "../src/domain/chronology";
import { validateCrownlineData } from "../src/domain/dataValidation";
import type { CrownlineData } from "../src/domain/types";

const data = dataJson as CrownlineData;

describe("生产历史数据", () => {
  it("完整迁移当前七个阶段和七十三个实体", () => {
    expect(data.timelineSections).toHaveLength(7);
    expect(data.entities).toHaveLength(73);
    expect(data.timelineSections.flatMap((section) => section.entityIds)).toHaveLength(73);
  });

  it("用多段区间表达唐和西秦的中断", () => {
    const tang = data.entities.find(({ id }) => id === "polity-cn-tang");
    const westernQin = data.entities.find(({ id }) => id === "polity-cn-western-qin");

    expect(tang?.existencePeriods).toHaveLength(2);
    expect(isYearInPeriods(690, tang?.existencePeriods ?? [])).toBe(true);
    expect(isYearInPeriods(691, tang?.existencePeriods ?? [])).toBe(false);
    expect(isYearInPeriods(705, tang?.existencePeriods ?? [])).toBe(true);

    expect(westernQin?.existencePeriods).toHaveLength(2);
    expect(isYearInPeriods(400, westernQin?.existencePeriods ?? [])).toBe(true);
    expect(isYearInPeriods(405, westernQin?.existencePeriods ?? [])).toBe(false);
    expect(isYearInPeriods(409, westernQin?.existencePeriods ?? [])).toBe(true);
  });

  it("通过结构和跨记录校验", () => {
    expect(validateCrownlineData(data)).toEqual({ valid: true, issues: [] });
    expect(loadCrownlineData().entities).toHaveLength(73);
  });
});
