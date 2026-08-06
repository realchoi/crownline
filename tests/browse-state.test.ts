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
      category: "contemporary"
    });
  });

  it("清洗非法模式、年份和类别", () => {
    expect(readBrowseState("?mode=map&year=0&type=unknown", bounds)).toEqual({
      mode: "overview",
      year: 1912,
      query: "",
      category: "all"
    });
    expect(readBrowseState("?mode=point&year=-9999", bounds).year).toBe(-2070);
    expect(readBrowseState("?mode=point&year=9999", bounds).year).toBe(1912);
  });

  it("序列化非默认状态并保留未知参数", () => {
    const params = writeBrowseState(
      { mode: "point", year: -221, query: "  秦  ", category: "mainline" },
      bounds,
      "?ref=shared"
    );

    expect(params.toString()).toBe("ref=shared&mode=point&year=-221&q=%E7%A7%A6&type=mainline");
  });

  it("从 URL 省略默认值", () => {
    const params = writeBrowseState(
      { mode: "overview", year: 1912, query: "", category: "all" },
      bounds
    );

    expect(params.toString()).toBe("");
  });
});
