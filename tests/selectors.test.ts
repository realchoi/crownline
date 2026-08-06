import { describe, expect, it } from "vitest";

import { loadCrownlineData } from "../src/data/loadCrownlineData";
import { selectBrowseResults } from "../src/domain/selectors";

const data = loadCrownlineData();

function names(year: number): string[] {
  return selectBrowseResults(data, { query: "", category: "all", year }).polities.map(
    ({ entity }) => entity.names.primary
  );
}

describe("时间点结果", () => {
  it("按多个存在区间排除中断期并包含复立年份", () => {
    expect(names(400)).toContain("西秦");
    expect(names(405)).not.toContain("西秦");
    expect(names(409)).toContain("西秦");
  });

  it("按照整年存在和闭区间规则处理政权交替端点", () => {
    expect(names(690)).toEqual(expect.arrayContaining(["唐", "武周"]));
    expect(names(691)).not.toContain("唐");
    expect(names(705)).toEqual(expect.arrayContaining(["唐", "武周"]));
  });

  it("把历史分期作为背景而不是政权结果", () => {
    const results = selectBrowseResults(data, { query: "", category: "all", year: -770 });

    expect(results.polities.map(({ entity }) => entity.names.primary)).toContain("东周");
    expect(results.polities.map(({ entity }) => entity.names.primary)).not.toContain("春秋");
    expect(results.historicalPeriods.map(({ entity }) => entity.names.primary)).toEqual(["春秋"]);
  });

  it("让年份、搜索和类别筛选组合生效", () => {
    const matched = selectBrowseResults(data, {
      query: "乞伏秦",
      category: "contemporary",
      year: 400
    });
    const wrongCategory = selectBrowseResults(data, {
      query: "乞伏秦",
      category: "mainline",
      year: 400
    });

    expect(matched.polities.map(({ entity }) => entity.names.primary)).toEqual(["西秦"]);
    expect(wrongCategory.all).toEqual([]);
  });

  it("在全览模式省略年份时保持原有七十三个结果", () => {
    const results = selectBrowseResults(data, { query: "", category: "all" });

    expect(results.all).toHaveLength(73);
    expect(results.polities).toHaveLength(71);
    expect(results.historicalPeriods).toHaveLength(2);
  });
});
