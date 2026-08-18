import { describe, expect, it } from "vitest";

import {
  getHistoricalYearBounds,
  readBrowseState,
  writeBrowseState
} from "../src/domain/browseState";
import { loadSourceData } from "../scripts/data-source";

const data = await loadSourceData();
const bounds = getHistoricalYearBounds(data);

describe("浏览状态", () => {
  it("从已加载实体的存在区间推导年份范围", () => {
    expect(bounds).toEqual({ min: -2070, max: 1922 });
  });

  it("从 URL 恢复时间点、年份、搜索和兼容类别", () => {
    expect(readBrowseState("?mode=point&year=-221&q=%E7%A7%A6&type=parallel", bounds)).toEqual({
      viewMode: "timeline",
      mode: "point",
      year: -221,
      query: "秦",
      category: "contemporary",
      regionScope: { mode: "global" },
      compareEntityIds: [],
      detailEntityId: null
    });
  });

  it("清洗非法模式、年份和类别", () => {
    expect(readBrowseState("?mode=map&year=0&type=unknown", bounds)).toEqual({
      viewMode: "timeline",
      mode: "overview",
      year: 1922,
      query: "",
      category: "all",
      regionScope: { mode: "global" },
      compareEntityIds: [],
      detailEntityId: null
    });
    expect(readBrowseState("?mode=point&year=-9999", bounds).year).toBe(-2070);
    expect(readBrowseState("?mode=point&year=9999", bounds).year).toBe(1922);
  });

  it("地图默认进入全览，显式年份链接进入时间点", () => {
    expect(readBrowseState("?view=map", bounds)).toMatchObject({
      viewMode: "map",
      mode: "overview",
      year: 1922
    });
    expect(readBrowseState("?view=map&year=1400", bounds)).toMatchObject({
      viewMode: "map",
      mode: "point",
      year: 1400
    });
    expect(readBrowseState("?view=unknown", bounds).viewMode).toBe("timeline");
  });

  it("只为地图视图写入 view 参数", () => {
    const defaultState = readBrowseState("", bounds);

    expect(writeBrowseState({ ...defaultState, viewMode: "map" }, bounds).get("view")).toBe("map");
    expect(writeBrowseState(defaultState, bounds).has("view")).toBe(false);
  });

  it("序列化非默认状态、中国范围并保留未知参数", () => {
    const params = writeBrowseState(
      {
        viewMode: "timeline",
        mode: "point",
        year: -221,
        query: "  秦  ",
        category: "mainline",
        regionScope: { mode: "china" },
        compareEntityIds: [],
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
        mode: "overview",
        year: 1922,
        query: "",
        category: "all",
        regionScope: { mode: "global" },
        compareEntityIds: [],
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
        { ...defaultState, viewMode: "map", mode: "point", year: bounds.max },
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
        mode: "point",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "custom", regionIds: ["region-south-asia", "region-europe"] },
        compareEntityIds: [],
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
        mode: "point",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "china" },
        compareEntityIds: [],
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
        mode: "overview",
        year: 1922,
        query: "",
        category: "all",
        regionScope: { mode: "global" },
        compareEntityIds: [],
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
      mode: "overview",
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
        mode: "overview",
        year: 1922,
        query: "",
        category: "all",
        regionScope: { mode: "global" },
        compareEntityIds: ["polity-cn-ming", "polity-cn-tang"],
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
