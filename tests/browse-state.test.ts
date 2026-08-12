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
      regionScope: { mode: "china" },
      compareEntityIds: []
    });
  });

  it("清洗非法模式、年份和类别", () => {
    expect(readBrowseState("?mode=map&year=0&type=unknown", bounds)).toEqual({
      viewMode: "timeline",
      mode: "overview",
      year: 1922,
      query: "",
      category: "all",
      regionScope: { mode: "china" },
      compareEntityIds: []
    });
    expect(readBrowseState("?mode=point&year=-9999", bounds).year).toBe(-2070);
    expect(readBrowseState("?mode=point&year=9999", bounds).year).toBe(1922);
  });

  it("独立恢复并清洗地图视图，不改写时间轴浏览模式", () => {
    expect(readBrowseState("?view=map&year=1400", bounds)).toMatchObject({
      viewMode: "map",
      mode: "overview",
      year: 1400
    });
    expect(readBrowseState("?view=unknown", bounds).viewMode).toBe("timeline");
  });

  it("只为地图视图写入 view 参数", () => {
    const defaultState = readBrowseState("", bounds);

    expect(writeBrowseState({ ...defaultState, viewMode: "map" }, bounds).get("view"))
      .toBe("map");
    expect(writeBrowseState(defaultState, bounds).has("view")).toBe(false);
  });

  it("序列化非默认状态并保留未知参数", () => {
    const params = writeBrowseState(
      {
        viewMode: "timeline",
        mode: "point",
        year: -221,
        query: "  秦  ",
        category: "mainline",
        regionScope: { mode: "china" },
        compareEntityIds: []
      },
      bounds,
      "?ref=shared"
    );

    expect(params.toString()).toBe("ref=shared&mode=point&year=-221&q=%E7%A7%A6&type=mainline");
  });

  it("从 URL 省略默认值", () => {
    const params = writeBrowseState(
      {
        viewMode: "timeline",
        mode: "overview",
        year: 1922,
        query: "",
        category: "all",
        regionScope: { mode: "china" },
        compareEntityIds: []
      },
      bounds
    );

    expect(params.toString()).toBe("");
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
      mode: "china"
    });
  });

  it("序列化自选与全球范围，默认中国范围不写入 URL", () => {
    const custom = writeBrowseState(
      {
        viewMode: "timeline",
        mode: "point",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "custom", regionIds: ["region-south-asia", "region-europe"] },
        compareEntityIds: []
      },
      bounds
    );
    expect(custom.toString()).toBe(
      "mode=point&year=1000&scope=custom&region=region-europe&region=region-south-asia"
    );

    const global = writeBrowseState(
      {
        viewMode: "timeline",
        mode: "point",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "global" },
        compareEntityIds: []
      },
      bounds
    );
    expect(global.toString()).toBe("mode=point&year=1000&scope=global");
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
        compareEntityIds: []
      },
      bounds
    );
    expect(params.toString()).toBe("scope=global");
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
        regionScope: { mode: "china" },
        compareEntityIds: ["polity-cn-ming", "polity-cn-tang"]
      },
      bounds
    );

    expect(params.toString()).toBe("compare=polity-cn-ming&compare=polity-cn-tang");
  });
});
