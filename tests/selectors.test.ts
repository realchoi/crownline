import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { selectBrowseResults } from "../src/domain/selectors";
import type { CrownlineData, HistoricalEntity } from "../src/domain/types";

const data = await loadSourceData();

function makeCrossRegionData(): CrownlineData {
  const result = structuredClone(data);
  const tang = result.entities.find(({ id }) => id === "polity-cn-tang")!;
  const externalEntity: HistoricalEntity = {
    ...structuredClone(tang),
    id: "polity-south-asia-test",
    names: { primary: "南亚测试政权", aliases: ["Test South Asian Polity"] },
    existencePeriods: [
      {
        start: { year: 900, precision: "exact" },
        end: { year: 1100, precision: "exact" }
      }
    ],
    historicalRegionIds: ["region-south-asia"]
  };
  delete externalEntity.displayRangeOverride;
  delete externalEntity.chronologyNote;
  result.entities.push(externalEntity);
  return result;
}

function names(year: number): string[] {
  return selectBrowseResults(data, { query: "", category: "all", year }).polities.map(
    ({ entity }) => entity.names.primary
  );
}

describe("时间点结果", () => {
  it("全球范围直接查询全部实体，不依赖中国时间轴分期", () => {
    const crossRegionData = makeCrossRegionData();
    const results = selectBrowseResults(
      crossRegionData,
      {
        query: "",
        category: "all",
        year: 1000,
        regionScope: { mode: "global" }
      }
    );

    expect(results.polities.map(({ entity }) => entity.names.primary)).toContain("南亚测试政权");
  });

  it("自选地区采用并集并展开父地区", () => {
    const crossRegionData = makeCrossRegionData();
    const results = selectBrowseResults(
      crossRegionData,
      {
        query: "",
        category: "all",
        year: 1000,
        regionScope: { mode: "custom", regionIds: ["region-east-asia", "region-south-asia"] }
      }
    );

    expect(results.polities.map(({ entity }) => entity.names.primary)).toEqual(
      expect.arrayContaining(["北宋", "南亚测试政权"])
    );
  });

  it("区分未收录、覆盖有限和被筛选为空", () => {
    const crossRegionData = makeCrossRegionData();
    const select = (year: number, query: string, regionId: string) => selectBrowseResults(
      crossRegionData,
      {
        query,
        category: "all",
        year,
        regionScope: { mode: "custom", regionIds: [regionId] }
      }
    );

    expect(select(1000, "", "region-east-africa").polityEmptyReason).toBe("limited-coverage");
    expect(select(760, "", "region-south-asia").polityEmptyReason).toBe("limited-coverage");
    expect(select(1000, "不存在", "region-south-asia").polityEmptyReason).toBe("filtered-out");
  });

  it("在 1500 年的美洲自选中返回已收录政权", () => {
    const results = selectBrowseResults(
      data,
      {
        query: "",
        category: "all",
        year: 1500,
        regionScope: { mode: "custom", regionIds: ["region-americas"] }
      }
    );

    expect(results.polityEmptyReason).toBeNull();
    expect(results.polities.map(({ entity }) => entity.names.primary)).toEqual(
      expect.arrayContaining(["阿兹特克帝国", "印加帝国"])
    );
  });

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
