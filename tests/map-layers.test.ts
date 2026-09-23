import { describe, expect, it } from "vitest";

import { getMapLayerNeeds, resolveRenderableMapLayer } from "../src/domain/mapLayers";

describe("地图图层判定", () => {
  it("按图层选择声明所需数据包", () => {
    expect(getMapLayerNeeds("points")).toEqual({ points: true, boundaries: false });
    expect(getMapLayerNeeds("boundaries")).toEqual({ points: false, boundaries: true });
    expect(getMapLayerNeeds("combined")).toEqual({ points: true, boundaries: true });
  });

  it("组合图层只渲染已就绪的一方", () => {
    expect(resolveRenderableMapLayer("combined", { points: true, boundaries: true })).toBe(
      "combined"
    );
    expect(resolveRenderableMapLayer("combined", { points: true, boundaries: false })).toBe(
      "points"
    );
    expect(resolveRenderableMapLayer("combined", { points: false, boundaries: true })).toBe(
      "boundaries"
    );
  });

  it("忽略未请求图层的数据，都未就绪时不渲染", () => {
    expect(resolveRenderableMapLayer("points", { points: false, boundaries: true })).toBeNull();
    expect(resolveRenderableMapLayer("boundaries", { points: true, boundaries: false })).toBeNull();
  });
});
