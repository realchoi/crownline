import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useGeographyData } from "../../src/app/useGeographyData";
import type { MapLayer, ViewMode } from "../../src/domain/browseState";
import type { GeographyLoadResult } from "../../src/data/loadCrownlineGeography";
import { createDeferred, loadGeneratedGeography } from "../helpers/renderApp";

describe("useGeographyData", () => {
  it("进入地图时懒加载并在切换视图后复用成功结果", async () => {
    const loadGeography = vi.fn(loadGeneratedGeography);
    const { result, rerender } = renderHook(
      ({ viewMode }: { viewMode: ViewMode }) => useGeographyData(viewMode, "points", loadGeography),
      { initialProps: { viewMode: "timeline" as ViewMode } }
    );

    expect(result.current.geographyState.status).toBe("idle");
    expect(loadGeography).not.toHaveBeenCalled();
    rerender({ viewMode: "map" });
    await waitFor(() => expect(result.current.geographyState.status).toBe("ready"));

    rerender({ viewMode: "timeline" });
    rerender({ viewMode: "map" });
    expect(result.current.geographyState.status).toBe("ready");
    expect(loadGeography).toHaveBeenCalledTimes(1);
  });

  it("失败后可重试", async () => {
    const loadGeography = vi
      .fn<() => Promise<GeographyLoadResult>>()
      .mockRejectedValueOnce(new Error("地图网络错误"))
      .mockImplementation(loadGeneratedGeography);
    const { result } = renderHook(() => useGeographyData("map", "points", loadGeography));

    await waitFor(() => expect(result.current.geographyState.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.geographyState.status).toBe("ready"));
    expect(loadGeography).toHaveBeenCalledTimes(2);
  });

  it("离开地图时隔离旧请求，重新进入只接受新结果", async () => {
    const first = createDeferred<GeographyLoadResult>();
    const second = createDeferred<GeographyLoadResult>();
    const loadGeography = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ viewMode }: { viewMode: ViewMode }) => useGeographyData(viewMode, "points", loadGeography),
      { initialProps: { viewMode: "map" as ViewMode } }
    );

    rerender({ viewMode: "timeline" });
    await waitFor(() => expect(result.current.geographyState.status).toBe("idle"));
    rerender({ viewMode: "map" });
    first.reject(new Error("迟到错误"));
    second.resolve(await loadGeneratedGeography());

    await waitFor(() => expect(result.current.geographyState.status).toBe("ready"));
    expect(loadGeography).toHaveBeenCalledTimes(2);
  });

  it("仅启用疆域时不加载点位，重新启用点位后才开始加载", async () => {
    const loadGeography = vi.fn(loadGeneratedGeography);
    const { result, rerender } = renderHook(
      ({ mapLayer }: { mapLayer: MapLayer }) => useGeographyData("map", mapLayer, loadGeography),
      { initialProps: { mapLayer: "boundaries" as MapLayer } }
    );

    expect(result.current.geographyState.status).toBe("idle");
    expect(loadGeography).not.toHaveBeenCalled();
    rerender({ mapLayer: "combined" });
    await waitFor(() => expect(result.current.geographyState.status).toBe("ready"));
    expect(loadGeography).toHaveBeenCalledTimes(1);
  });

  it("关闭点位图层后隔离旧请求，重新启用时只接受新结果", async () => {
    const first = createDeferred<GeographyLoadResult>();
    const second = createDeferred<GeographyLoadResult>();
    const loadGeography = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ mapLayer }: { mapLayer: MapLayer }) => useGeographyData("map", mapLayer, loadGeography),
      { initialProps: { mapLayer: "combined" as MapLayer } }
    );

    expect(result.current.geographyState.status).toBe("loading");
    rerender({ mapLayer: "boundaries" });
    await waitFor(() => expect(result.current.geographyState.status).toBe("idle"));
    rerender({ mapLayer: "combined" });
    first.reject(new Error("旧点位请求错误"));
    second.resolve(await loadGeneratedGeography());

    await waitFor(() => expect(result.current.geographyState.status).toBe("ready"));
    expect(result.current.geographyState).not.toMatchObject({ message: "旧点位请求错误" });
    expect(loadGeography).toHaveBeenCalledTimes(2);
  });
});
