import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEntityDetail } from "../../src/app/useEntityDetail";
import type { CrownlineDetail } from "../../src/domain/types";
import { artifacts, createDeferred } from "../helpers/renderApp";

const noDetailIds: string[] = [];
const mingDetailIds = ["polity-cn-ming"];
const comparisonDetailIds = ["polity-cn-ming", "polity-cn-qing"];

describe("useEntityDetail", () => {
  it("对不在详情索引中的实体直接返回 missing", () => {
    const loadDetail = vi.fn();
    const { result } = renderHook(() => useEntityDetail("period-missing", noDetailIds, loadDetail));

    expect(result.current.detailState).toEqual({ status: "missing" });
    expect(loadDetail).not.toHaveBeenCalled();
  });

  it("暴露加载错误并允许重试", async () => {
    const detail = artifacts.details.get("polity-cn-ming")!;
    const loadDetail = vi
      .fn<() => Promise<CrownlineDetail | null>>()
      .mockRejectedValueOnce(new Error("临时错误"))
      .mockResolvedValue(detail);
    const { result } = renderHook(() =>
      useEntityDetail("polity-cn-ming", mingDetailIds, loadDetail)
    );

    await waitFor(() => expect(result.current.detailState.status).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.detailState).toEqual({ status: "ready", detail }));
    expect(loadDetail).toHaveBeenCalledTimes(2);
  });

  it("关闭或快速切换实体后忽略旧请求的迟到响应", async () => {
    const ming = createDeferred<CrownlineDetail | null>();
    const qing = createDeferred<CrownlineDetail | null>();
    const loadDetail = (entityId: string) =>
      entityId === "polity-cn-ming" ? ming.promise : qing.promise;
    const { result, rerender } = renderHook(
      ({ entityId }: { entityId: string | null }) =>
        useEntityDetail(entityId, comparisonDetailIds, loadDetail),
      { initialProps: { entityId: "polity-cn-ming" as string | null } }
    );

    rerender({ entityId: "polity-cn-qing" });
    ming.reject(new Error("旧请求错误"));
    qing.resolve(artifacts.details.get("polity-cn-qing")!);
    await waitFor(() => expect(result.current.detailState.status).toBe("ready"));
    expect(result.current.detailState).toMatchObject({
      status: "ready",
      detail: { entityId: "polity-cn-qing" }
    });

    rerender({ entityId: null });
    expect(result.current.detailState).toEqual({ status: "missing" });
  });
});
