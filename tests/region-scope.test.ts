import { describe, expect, it } from "vitest";

import { getRegionNames, getRegionsByIds } from "../src/domain/regionScope";
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
