import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useLazyResource } from "../../src/app/useLazyResource";
import { createDeferred } from "../helpers/renderApp";

describe("useLazyResource", () => {
  it("停用时不加载，启用后加载并在重新启用时复用成功结果", async () => {
    const load = vi.fn(async () => "value");
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useLazyResource(enabled, load),
      { initialProps: { enabled: false } }
    );

    expect(result.current.state).toEqual({ status: "idle" });
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", result: "value" }));
    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(result.current.state).toEqual({ status: "ready", result: "value" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("失败后通过 retry 重新请求", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("网络错误"))
      .mockResolvedValue("value");
    const { result } = renderHook(() => useLazyResource(true, load));

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "error", message: "网络错误" })
    );
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", result: "value" }));
  });

  it("停用期间的迟到结果不会写回", async () => {
    const stale = createDeferred<string>();
    const fresh = createDeferred<string>();
    const load = vi.fn().mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useLazyResource<string>(enabled, load),
      { initialProps: { enabled: true } }
    );

    rerender({ enabled: false });
    await waitFor(() => expect(result.current.state).toEqual({ status: "idle" }));
    rerender({ enabled: true });
    stale.resolve("stale");
    fresh.resolve("fresh");
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", result: "fresh" }));
  });
});
