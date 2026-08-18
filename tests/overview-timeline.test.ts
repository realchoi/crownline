import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildOverviewTimelineGroups } from "../src/domain/overviewTimeline";
import type { RegionScope } from "../src/domain/regionScope";
import { selectBrowseResults, type MatchedEntity } from "../src/domain/selectors";
import type { HistoricalEntity } from "../src/domain/types";

const data = await loadSourceData();

function overviewMatches(regionScope: RegionScope): MatchedEntity[] {
  return selectBrowseResults(data, {
    query: "",
    category: "all",
    regionScope
  }).all;
}

describe("多地区全览分组", () => {
  it("中国范围保持七个历史阶段的顺序和局部尺度", () => {
    const groups = buildOverviewTimelineGroups(data, overviewMatches({ mode: "china" }), {
      mode: "china"
    });

    expect(groups.map(({ id }) => id)).toEqual(data.timelineSections.map(({ id }) => id));
    expect(groups.map(({ range }) => range)).toEqual(
      data.timelineSections.map(({ range }) => range)
    );
    expect(groups.flatMap(({ matches }) => matches)).toHaveLength(73);
  });

  it("全球范围把跨地区实体单独分组且各显示一次", () => {
    const groups = buildOverviewTimelineGroups(data, overviewMatches({ mode: "global" }), {
      mode: "global"
    });
    const crossRegion = groups[0]!;
    const groupedIds = groups.flatMap(({ matches }) => matches.map(({ entity }) => entity.id));

    expect(crossRegion).toMatchObject({
      id: "overview-cross-region",
      title: "跨地区政权",
      kind: "cross-region"
    });
    expect(crossRegion.matches.map(({ entity }) => entity.names.primary)).toEqual(
      expect.arrayContaining(["贵霜帝国", "拜占庭帝国", "阿拔斯哈里发", "帖木儿帝国", "奥斯曼帝国"])
    );
    expect(groupedIds.filter((id) => id === "polity-byzantine-empire")).toHaveLength(1);
    expect(groupedIds.filter((id) => id === "polity-abbasid-caliphate")).toHaveLength(1);
    expect(groupedIds.filter((id) => id === "polity-kushan-empire")).toHaveLength(1);
    expect(groupedIds.filter((id) => id === "polity-timurid-empire")).toHaveLength(1);
    expect(groupedIds.filter((id) => id === "polity-ottoman-empire")).toHaveLength(1);
    expect(new Set(groupedIds).size).toBe(groupedIds.length);
  });

  it("单选欧洲时把欧洲相关实体放在同一地区组", () => {
    const scope: RegionScope = { mode: "custom", regionIds: ["region-europe"] };
    const groups = buildOverviewTimelineGroups(data, overviewMatches(scope), scope);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: "overview-region-region-europe",
      title: "欧洲",
      kind: "region"
    });
    expect(groups[0]!.matches.map(({ entity }) => entity.names.primary)).toEqual(
      expect.arrayContaining([
        "法兰克王国",
        "英格兰王国",
        "拜占庭帝国",
        "神圣罗马帝国",
        "奥斯曼帝国"
      ])
    );
  });

  it("选择欧洲与西亚时把同时命中的拜占庭与奥斯曼移入跨地区组", () => {
    const scope: RegionScope = {
      mode: "custom",
      regionIds: ["region-europe", "region-west-asia"]
    };
    const groups = buildOverviewTimelineGroups(data, overviewMatches(scope), scope);

    expect(groups[0]!.matches.map(({ entity }) => entity.names.primary)).toEqual(
      expect.arrayContaining(["拜占庭帝国", "奥斯曼帝国"])
    );
    expect(
      groups
        .find(({ regionId }) => regionId === "region-europe")
        ?.matches.map(({ entity }) => entity.names.primary)
    ).toEqual(expect.arrayContaining(["法兰克王国", "英格兰王国", "神圣罗马帝国"]));
    expect(
      groups
        .find(({ regionId }) => regionId === "region-west-asia")
        ?.matches.map(({ entity }) => entity.names.primary)
    ).toEqual(expect.arrayContaining(["阿拔斯哈里发", "塞尔柱帝国", "帖木儿帝国"]));

    const groupedIds = groups.flatMap(({ matches }) => matches.map(({ entity }) => entity.id));
    expect(groupedIds.filter((id) => id === "polity-byzantine-empire")).toHaveLength(1);
    expect(groupedIds.filter((id) => id === "polity-ottoman-empire")).toHaveLength(1);
    expect(new Set(groupedIds).size).toBe(groupedIds.length);
  });

  it("按起点、终点和名称稳定排序并使用组内局部范围", () => {
    const scope: RegionScope = { mode: "custom", regionIds: ["region-europe"] };
    const [europe] = buildOverviewTimelineGroups(data, overviewMatches(scope), scope);

    expect(europe!.range).toEqual({ startYear: 330, endYear: 1922 });
    expect(europe!.matches.map(({ entity }) => entity.names.primary)).toEqual(
      expect.arrayContaining([
        "法兰克王国",
        "英格兰王国",
        "拜占庭帝国",
        "神圣罗马帝国",
        "奥斯曼帝国"
      ])
    );
  });

  it("单选西非时生成独立地区组", () => {
    const scope: RegionScope = { mode: "custom", regionIds: ["region-west-africa"] };
    const groups = buildOverviewTimelineGroups(data, overviewMatches(scope), scope);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: "overview-region-region-west-africa",
      title: "西非",
      kind: "region",
      range: { startYear: 700, endYear: 1893 }
    });
    expect(groups[0]!.matches.map(({ entity }) => entity.names.primary)).toEqual(
      expect.arrayContaining(["马里帝国", "桑海帝国", "卡涅姆-博尔努帝国"])
    );
    expect(groups[0]!.matches).toHaveLength(3);
  });

  it("单年实体扩展为安全绘制跨度且不产生空组", () => {
    const template = data.entities.find(({ id }) => id === "polity-chola-empire")!;
    const singleYearEntity: HistoricalEntity = {
      ...structuredClone(template),
      id: "polity-single-year-test",
      names: { primary: "单年政权", aliases: [] },
      existencePeriods: [
        {
          start: { year: 1000, precision: "exact" },
          end: { year: 1000, precision: "exact" }
        }
      ]
    };
    const groups = buildOverviewTimelineGroups(
      data,
      [{ entity: singleYearEntity, section: undefined }],
      { mode: "custom", regionIds: ["region-south-asia"] }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      displayRange: "1000",
      range: { startYear: 1000, endYear: 1001 }
    });
    expect(
      buildOverviewTimelineGroups(data, [], { mode: "custom", regionIds: ["region-south-asia"] })
    ).toEqual([]);
  });
});
