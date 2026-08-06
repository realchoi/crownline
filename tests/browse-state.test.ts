import { describe, expect, it } from "vitest";

import {
  getHistoricalYearBounds,
  readBrowseState,
  writeBrowseState
} from "../src/domain/browseState";
import { loadCrownlineData } from "../src/data/loadCrownlineData";

const data = loadCrownlineData();
const bounds = getHistoricalYearBounds(data);

describe("浏览状态", () => {
  it("从已加载实体的存在区间推导年份范围", () => {
    expect(bounds).toEqual({ min: -2070, max: 1912 });
  });

  it("从 URL 恢复时间点、年份、搜索和兼容类别", () => {
    expect(readBrowseState("?mode=point&year=-221&q=%E7%A7%A6&type=parallel", bounds)).toEqual({
      mode: "point",
      year: -221,
      query: "秦",
      category: "contemporary",
      regionScope: { mode: "china" }
    });
  });

  it("清洗非法模式、年份和类别", () => {
    expect(readBrowseState("?mode=map&year=0&type=unknown", bounds)).toEqual({
      mode: "overview",
      year: 1912,
      query: "",
      category: "all",
      regionScope: { mode: "china" }
    });
    expect(readBrowseState("?mode=point&year=-9999", bounds).year).toBe(-2070);
    expect(readBrowseState("?mode=point&year=9999", bounds).year).toBe(1912);
  });

  it("序列化非默认状态并保留未知参数", () => {
    const params = writeBrowseState(
      {
        mode: "point",
        year: -221,
        query: "  秦  ",
        category: "mainline",
        regionScope: { mode: "china" }
      },
      bounds,
      "?ref=shared"
    );

    expect(params.toString()).toBe("ref=shared&mode=point&year=-221&q=%E7%A7%A6&type=mainline");
  });

  it("从 URL 省略默认值", () => {
    const params = writeBrowseState(
      {
        mode: "overview",
        year: 1912,
        query: "",
        category: "all",
        regionScope: { mode: "china" }
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
        mode: "point",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "custom", regionIds: ["region-south-asia", "region-europe"] }
      },
      bounds
    );
    expect(custom.toString()).toBe(
      "mode=point&year=1000&scope=custom&region=region-europe&region=region-south-asia"
    );

    const global = writeBrowseState(
      {
        mode: "point",
        year: 1000,
        query: "",
        category: "all",
        regionScope: { mode: "global" }
      },
      bounds
    );
    expect(global.toString()).toBe("mode=point&year=1000&scope=global");
  });

  it("全览模式忽略阶段 2 的地区范围参数", () => {
    expect(readBrowseState("?scope=global", bounds, data.regions).regionScope).toEqual({
      mode: "china"
    });
    const params = writeBrowseState(
      {
        mode: "overview",
        year: 1912,
        query: "",
        category: "all",
        regionScope: { mode: "global" }
      },
      bounds
    );
    expect(params.toString()).toBe("");
  });
});
