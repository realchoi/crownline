import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBoundaryData } from "../../src/app/useBoundaryData";
import type { MapLayer, ViewMode } from "../../src/domain/browseState";
import type { BoundaryLoadResult } from "../../src/data/loadCrownlineBoundaries";
import { createDeferred, loadGeneratedBoundaries } from "../helpers/renderApp";

describe("useBoundaryData", () => {
  it("点位图层不加载疆域，启用疆域后加载并缓存成功结果", async () => {
    const loadBoundaries = vi.fn(loadGeneratedBoundaries);
    const { result, rerender } = renderHook(
      ({ viewMode, mapLayer }: { viewMode: ViewMode; mapLayer: MapLayer }) =>
        useBoundaryData(viewMode, mapLayer, loadBoundaries),
      { initialProps: { viewMode: "map" as ViewMode, mapLayer: "points" as MapLayer } }
    );

    expect(result.current.boundaryState.status).toBe("idle");
    expect(loadBoundaries).not.toHaveBeenCalled();
    rerender({ viewMode: "map", mapLayer: "boundaries" });
    await waitFor(() => expect(result.current.boundaryState.status).toBe("ready"));
    rerender({ viewMode: "timeline", mapLayer: "points" });
    rerender({ viewMode: "map", mapLayer: "combined" });
    expect(result.current.boundaryState.status).toBe("ready");
    expect(loadBoundaries).toHaveBeenCalledTimes(1);
  });

  it("加载失败后显示错误并允许重试", async () => {
    const loadBoundaries = vi
      .fn<() => Promise<BoundaryLoadResult>>()
      .mockRejectedValueOnce(new Error("疆域网络错误"))
      .mockImplementation(loadGeneratedBoundaries);
    const { result } = renderHook(() => useBoundaryData("map", "boundaries", loadBoundaries));

    await waitFor(() => expect(result.current.boundaryState.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.boundaryState.status).toBe("ready"));
    expect(loadBoundaries).toHaveBeenCalledTimes(2);
  });

  it("切回点位或切换请求时忽略迟到结果", async () => {
    const first = createDeferred<BoundaryLoadResult>();
    const second = createDeferred<BoundaryLoadResult>();
    const loadBoundaries = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ mapLayer }: { mapLayer: MapLayer }) => useBoundaryData("map", mapLayer, loadBoundaries),
      { initialProps: { mapLayer: "boundaries" as MapLayer } }
    );

    expect(result.current.boundaryState.status).toBe("loading");
    rerender({ mapLayer: "points" });
    await waitFor(() => expect(result.current.boundaryState.status).toBe("idle"));
    rerender({ mapLayer: "combined" });
    first.reject(new Error("旧请求错误"));
    second.resolve(await loadGeneratedBoundaries());
    await waitFor(() => expect(result.current.boundaryState.status).toBe("ready"));
    expect(result.current.boundaryState).not.toMatchObject({ message: "旧请求错误" });
    expect(loadBoundaries).toHaveBeenCalledTimes(2);
  });
});
