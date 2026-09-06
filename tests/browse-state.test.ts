import { describe, expect, it } from "vitest";

import {
  clearAdditionalFilters,
  getHistoricalYearBounds,
  readBrowseState,
  selectBrowseYear,
  selectTimeRange,
  writeBrowseState
} from "../src/domain/browseState";
import { loadSourceData } from "../scripts/data-source";

const data = await loadSourceData();
const bounds = getHistoricalYearBounds(data);

describe("浏览状态", () => {
  it("对比弹窗显式恢复，缺省和非法入口保持关闭，详情优先", () => {
    const query = "?compare=polity-cn-tang&compare=polity-cn-ming";
    const read = (suffix: string) =>
      readBrowseState(query + suffix, bounds, data.regions, data.entities);
    expect(read("").comparisonOpen).toBe(false);
    expect(read("&comparison=invalid").comparisonOpen).toBe(false);
    expect(read("&comparison=open").comparisonOpen).toBe(true);
    expect(read("&comparison=open&detail=polity-cn-tang").comparisonOpen).toBe(false);
    expect(
      readBrowseState("?compare=missing&comparison=open", bounds, data.regions, data.entities)
        .comparisonOpen
    ).toBe(false);
    const state = read("&comparison=open");
    const params = writeBrowseState(state, bounds, "?custom=keep&comparison=invalid");
    expect(params.toString()).toBe(
      "custom=keep&compare=polity-cn-tang&compare=polity-cn-ming&comparison=open"
    );
    expect(
      writeBrowseState({ ...state, comparisonOpen: false }, bounds, params.toString()).has(
        "comparison"
      )
    ).toBe(false);
    expect(writeBrowseState({ ...state, compareEntityIds: [] }, bounds).has("comparison")).toBe(
      false
    );
  });

  it("从已加载实体的存在区间推导年份范围", () => {
    expect(bounds).toEqual({ min: -2070, max: 1922 });
  });

  it("从 URL 恢复时间点、年份、搜索和兼容类别", () => {
    expect(readBrowseState("?mode=point&year=-221&q=%E7%A7%A6&type=parallel", bounds)).toEqual({
      viewMode: "timeline",
      mapLayer: "points",
      timeRange: "year",
      year: -221,
      query: "秦",
      category: "contemporary",
      regionScope: { mode: "global" },
      compareEntityIds: [],
      comparisonOpen: false,
      detailEntityId: null
    });
  });

  it("清洗非法模式、年份和类别", () => {
    expect(readBrowseState("?mode=map&year=0&type=unknown", bounds)).toEqual({
      viewMode: "timeline",
      mapLayer: "points",
      timeRange: "all",
      year: 1922,
      query: "",
      category: "all",
      regionScope: { mode: "global" },
      compareEntityIds: [],
      comparisonOpen: false,
      detailEntityId: null
    });
    expect(readBrowseState("?mode=point&year=-9999", bounds).year).toBe(-2070);
    expect(readBrowseState("?mode=point&year=9999", bounds).year).toBe(1922);
  });

  it("地图默认进入全览，显式年份链接进入时间点", () => {
    expect(readBrowseState("?view=map", bounds)).toMatchObject({
      viewMode: "map",
      timeRange: "all",
      year: 1922
    });
    expect(readBrowseState("?view=map&year=1400", bounds)).toMatchObject({
      viewMode: "map",
      timeRange: "year",
      year: 1400
    });
    expect(readBrowseState("?view=unknown", bounds).viewMode).toBe("timeline");
    expect(readBrowseState("?view=map&layer=invalid", bounds).mapLayer).toBe("points");
  });

  it("兼容旧地图年份链接，并让显式全览优先于遗留 year 参数", () => {
    const legacyMapYear = readBrowseState("?view=map&year=1400", bounds);
    expect(legacyMapYear).toMatchObject({
      viewMode: "map",
      timeRange: "year",
      year: 1400
    });
    expect(writeBrowseState(legacyMapYear, bounds).toString()).toBe(
      "view=map&mode=point&year=1400"
    );

    const explicitOverview = readBrowseState("?view=map&mode=overview&year=1400", bounds);
    expect(explicitOverview).toMatchObject({ timeRange: "all", year: 1400 });
    expect(writeBrowseState(explicitOverview, bounds).toString()).toBe("view=map");
  });

  it("完整恢复旧 URL 参数组合", () => {
    const state = readBrowseState(
      [
        "?view=map",
        "mode=point",
        "year=-221",
        "scope=custom",
        "region=region-east-asia",
        "type=parallel",
        "q=%E7%A7%A6",
        "compare=polity-cn-qin",
        "detail=polity-cn-qin",
        "layer=combined"
      ].join("&"),
      bounds,
      data.regions,
      data.entities
    );

    expect(state).toMatchObject({
      viewMode: "map",
      timeRange: "year",
      year: -221,
      mapLayer: "combined",
      query: "秦",
      category: "contemporary",
      regionScope: { mode: "custom", regionIds: ["region-east-asia"] },
      compareEntityIds: ["polity-cn-qin"],
      detailEntityId: "polity-cn-qin"
    });
  });

  it("状态转换只改变各自负责的维度", () => {
    const initial = readBrowseState(
      "?view=map&mode=point&year=800&scope=china&q=%E5%94%90&type=mainline&compare=polity-cn-tang&detail=polity-cn-tang&layer=combined",
      bounds,
      data.regions,
      data.entities
    );
    const allTime = selectTimeRange(initial, "all");
    expect(allTime).toEqual({ ...initial, timeRange: "all" });
    expect(selectTimeRange(allTime, "year").year).toBe(800);
    expect(selectBrowseYear(allTime, 900)).toEqual({
      ...initial,
      timeRange: "year",
      year: 900
    });
    expect(clearAdditionalFilters(initial)).toEqual({
      ...initial,
      query: "",
      category: "all"
    });
  });

  it("只为地图视图写入 view 参数", () => {
    const defaultState = readBrowseState("", bounds);

    expect(writeBrowseState({ ...defaultState, viewMode: "map" }, bounds).get("view")).toBe("map");
    expect(writeBrowseState(defaultState, bounds).has("view")).toBe(false);
  });

  it("只为非默认疆域图层写入简洁 URL 参数", () => {
    const defaultState = readBrowseState("", bounds);
    expect(
      writeBrowseState(
        { ...defaultState, viewMode: "map", mapLayer: "boundaries" },
        bounds
      ).toString()
    ).toBe("view=map&layer=boundaries");
    expect(writeBrowseState({ ...defaultState, mapLayer: "combined" }, bounds).has("layer")).toBe(
      false
    );
  });

  it("序列化非默认状态、中国范围并保留未知参数", () => {
    const params = writeBrowseState(
      {
        viewMode: "timeline",
        mapLayer: "points",
        timeRange: "year",
        year: -221,
        query: "  秦  ",
        category: "mainline",
        regionScope: { mode: "china" },
        compareEntityIds: [],
        comparisonOpen: false,
        detailEntityId: null
      },
      bounds,
      "?ref=shared"
    );

    expect(params.toString()).toBe(
      "ref=shared&mode=point&year=-221&q=%E7%A7%A6&type=mainline&scope=china"
    );
  });

  it("从 URL 省略默认值", () => {
    const params = writeBrowseState(
      {
        viewMode: "timeline",
        mapLayer: "points",
        timeRange: "all",
        year: 1922,
        query: "",
        category: "all",
        regionScope: { mode: "global" },
        compareEntityIds: [],
        comparisonOpen: false,
        detailEntityId: null
      },
      bounds
    );

    expect(params.toString()).toBe("");
  });

  it("全览不写入隐藏年份，地图时间点在最大年份保留模式", () => {
    const defaultState = readBrowseState("", bounds);
    expect(writeBrowseState({ ...defaultState, year: 1400 }, bounds).has("year")).toBe(false);
    expect(
      writeBrowseState(
        { ...defaultState, viewMode: "map", timeRange: "year", year: bounds.max },
        bounds
      ).toString()
    ).toBe("view=map&mode=point");
  });

  it("恢复并清洗自选地区参数", () => {
    expect(
      readBrowseState(
        "?mode=point&scope=custom&region=region-east-asia&region=region-missing",
        bounds,
        data.regions
      ).regionScope
    ).toEqual({ mode: "custom", regionIds: ["region-east-asia"] });

    expect(readBrowseState("?scope=custom", bounds, data.regions).regionScope).toEqual({
      mode: "global"
    });
  });

  it("序列化自选与中国范围，默认全球范围不写入 URL", () => {
    const custom = writeBrowseState(
      {
        viewMode: "timeline",
        mapLayer: "points",
        timeRange: "year",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "custom", regionIds: ["region-south-asia", "region-europe"] },
        compareEntityIds: [],
        comparisonOpen: false,
        detailEntityId: null
      },
      bounds
    );
    expect(custom.toString()).toBe(
      "mode=point&year=1000&scope=custom&region=region-europe&region=region-south-asia"
    );

    const china = writeBrowseState(
      {
        viewMode: "timeline",
        mapLayer: "points",
        timeRange: "year",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "china" },
        compareEntityIds: [],
        comparisonOpen: false,
        detailEntityId: null
      },
      bounds
    );
    expect(china.toString()).toBe("mode=point&year=1000&scope=china");
  });

  it("全览模式恢复并序列化全球范围", () => {
    expect(readBrowseState("?scope=global", bounds, data.regions).regionScope).toEqual({
      mode: "global"
    });
    const params = writeBrowseState(
      {
        viewMode: "timeline",
        mapLayer: "points",
        timeRange: "all",
        year: 1922,
        query: "",
        category: "all",
        regionScope: { mode: "global" },
        compareEntityIds: [],
        comparisonOpen: false,
        detailEntityId: null
      },
      bounds
    );
    expect(params.toString()).toBe("");
  });

  it("全览模式恢复并规范化自选地区", () => {
    const state = readBrowseState(
      "?scope=custom&region=region-west-asia&region=region-europe&region=region-missing",
      bounds,
      data.regions
    );

    expect(state).toMatchObject({
      timeRange: "all",
      regionScope: {
        mode: "custom",
        regionIds: ["region-europe", "region-west-asia"]
      }
    });
    expect(writeBrowseState(state, bounds).toString()).toBe(
      "scope=custom&region=region-europe&region=region-west-asia"
    );
  });

  it("恢复对比政权时去重、过滤无效实体并保留前两个顺序", () => {
    const state = readBrowseState(
      [
        "?compare=polity-cn-tang",
        "compare=period-cn-spring-autumn",
        "compare=polity-missing",
        "compare=polity-cn-tang",
        "compare=polity-cn-ming",
        "compare=polity-cn-qing"
      ].join("&"),
      bounds,
      data.regions,
      data.entities
    );

    expect(state.compareEntityIds).toEqual(["polity-cn-tang", "polity-cn-ming"]);
  });

  it("按左右顺序序列化两个对比政权", () => {
    const params = writeBrowseState(
      {
        viewMode: "timeline",
        mapLayer: "points",
        timeRange: "all",
        year: 1922,
        query: "",
        category: "all",
        regionScope: { mode: "global" },
        compareEntityIds: ["polity-cn-ming", "polity-cn-tang"],
        comparisonOpen: false,
        detailEntityId: null
      },
      bounds
    );

    expect(params.toString()).toBe("compare=polity-cn-ming&compare=polity-cn-tang");
  });

  it("恢复并清洗详情深链接，忽略无效实体", () => {
    expect(
      readBrowseState("?detail=polity-cn-ming", bounds, data.regions, data.entities).detailEntityId
    ).toBe("polity-cn-ming");
    expect(
      readBrowseState("?detail=period-cn-spring-autumn", bounds, data.regions, data.entities)
        .detailEntityId
    ).toBe("period-cn-spring-autumn");
    expect(
      readBrowseState("?detail=polity-missing", bounds, data.regions, data.entities).detailEntityId
    ).toBeNull();
  });

  it("只在打开详情时写入 detail 参数", () => {
    const defaultState = readBrowseState("", bounds, data.regions, data.entities);
    expect(writeBrowseState(defaultState, bounds).has("detail")).toBe(false);

    const withDetail = writeBrowseState(
      { ...defaultState, detailEntityId: "polity-cn-tang" },
      bounds
    );
    expect(withDetail.get("detail")).toBe("polity-cn-tang");
  });
});
