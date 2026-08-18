import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBrowseUrlState } from "../../src/app/useBrowseUrlState";
import { getHistoricalYearBounds } from "../../src/domain/browseState";
import { artifacts } from "../helpers/renderApp";

const yearBounds = getHistoricalYearBounds(artifacts.index);
const options = {
  yearBounds,
  regions: artifacts.index.regions,
  entities: artifacts.index.entities
};

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("useBrowseUrlState", () => {
  it("从 URL 初始化并在普通状态变化时替换且保留未知参数", async () => {
    window.history.replaceState(null, "", "/?campaign=archive&q=%E5%94%90");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useBrowseUrlState(options));

    expect(result.current.browseState.query).toBe("唐");
    act(() => result.current.setBrowseState((current) => ({ ...current, category: "mainline" })));

    await waitFor(() => expect(new URLSearchParams(location.search).get("type")).toBe("mainline"));
    expect(new URLSearchParams(location.search).get("campaign")).toBe("archive");
    expect(replaceState).toHaveBeenCalled();
  });

  it("仅在详情开关变化时创建历史记录", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useBrowseUrlState(options));

    act(() =>
      result.current.setBrowseState((current) => ({
        ...current,
        detailEntityId: "polity-cn-tang"
      }))
    );
    await waitFor(() => expect(pushState).toHaveBeenCalledTimes(1));

    act(() => result.current.setBrowseState((current) => ({ ...current, query: "唐" })));
    await waitFor(() => expect(new URLSearchParams(location.search).get("q")).toBe("唐"));
    expect(pushState).toHaveBeenCalledTimes(1);

    act(() => result.current.setBrowseState((current) => ({ ...current, detailEntityId: null })));
    await waitFor(() => expect(pushState).toHaveBeenCalledTimes(2));
  });

  it("恢复 popstate 后不会立即覆盖浏览器中的状态", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useBrowseUrlState(options));
    replaceState.mockClear();

    window.history.replaceState(null, "", "/?mode=point&year=705&external=kept");
    replaceState.mockClear();
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));

    await waitFor(() => expect(result.current.browseState.year).toBe(705));
    expect(result.current.browseState.mode).toBe("point");
    expect(location.search).toContain("external=kept");
    expect(replaceState).not.toHaveBeenCalled();
  });
});
