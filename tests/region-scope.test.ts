import { describe, expect, it } from "vitest";

import {
  createRegionScopeMatcher,
  getRegionNames,
  getRegionsByIds
} from "../src/domain/regionScope";
import type { HistoricalEntity } from "../src/domain/types";
import { artifacts } from "./helpers/renderApp";

const regions = artifacts.index.regions;
const [first, second] = regions;
if (!first || !second) throw new Error("缺少地区测试数据");

describe("地区查询", () => {
  it("按调用方给定的 ID 顺序返回地区", () => {
    expect(getRegionsByIds(regions, [second.id, first.id])).toEqual([second, first]);
  });

  it("跳过当前数据中不存在的地区 ID", () => {
    expect(getRegionNames(regions, ["region-missing", first.id])).toEqual([first.names.primary]);
  });
});

function entityIn(...historicalRegionIds: string[]): HistoricalEntity {
  const [template] = artifacts.index.entities;
  if (!template) throw new Error("缺少实体测试数据");
  return { ...template, historicalRegionIds };
}

describe("地区范围匹配", () => {
  it("全球范围匹配任意实体", () => {
    expect(createRegionScopeMatcher(regions, { mode: "global" })(entityIn())).toBe(true);
  });

  it("中国范围只匹配中国地区", () => {
    const matches = createRegionScopeMatcher(regions, { mode: "china" });
    expect(matches(entityIn("region-china"))).toBe(true);
    expect(matches(entityIn("region-east-asia"))).toBe(false);
  });

  it("选择父地区时包含后代地区", () => {
    const matches = createRegionScopeMatcher(regions, {
      mode: "custom",
      regionIds: ["region-east-asia"]
    });
    expect(matches(entityIn("region-china"))).toBe(true);
    expect(matches(entityIn("region-europe"))).toBe(false);
  });

  it("多地区采用并集", () => {
    const matches = createRegionScopeMatcher(regions, {
      mode: "custom",
      regionIds: ["region-europe", "region-americas"]
    });
    expect(matches(entityIn("region-americas"))).toBe(true);
    expect(matches(entityIn("region-west-asia", "region-europe"))).toBe(true);
    expect(matches(entityIn("region-south-asia"))).toBe(false);
  });
});
