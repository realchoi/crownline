import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installAppTestLifecycle, renderApp } from "../helpers/renderApp";
import { setupUser } from "../helpers/user";

installAppTestLifecycle();

const originalMatchMedia = window.matchMedia;

function mockMobileViewport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 800px)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia
  });
  document.body.classList.remove("filter-sheet-open");
});

describe("探索控制台", () => {
  it("完整控制台滚出视口后显示紧凑工具条，并以回滞阈值恢复", async () => {
    mockMobileViewport(false);
    renderApp();
    const consoleElement = document.querySelector<HTMLElement>(".full-exploration-console");
    expect(consoleElement).not.toBeNull();

    let bottom = 6;
    vi.spyOn(consoleElement!, "getBoundingClientRect").mockImplementation(() => ({
      x: 0,
      y: 0,
      top: -300,
      right: 1000,
      bottom,
      left: 0,
      width: 1000,
      height: 306,
      toJSON: () => ({})
    }));
    fireEvent.scroll(window);
    expect(await screen.findByRole("region", { name: "紧凑探索工具条" })).toHaveTextContent(
      "时间轴"
    );

    bottom = 96;
    fireEvent.scroll(window);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "紧凑探索工具条" })).not.toBeInTheDocument()
    );
  });

  it("移动抽屉打开后聚焦关闭按钮，关闭后恢复触发按钮焦点", async () => {
    mockMobileViewport(true);
    const user = setupUser();
    renderApp();

    const trigger = screen.getByRole("button", { name: "筛选" });
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "筛选与呈现" });
    const close = within(dialog).getByRole("button", { name: "关闭筛选" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(document.body).toHaveClass("filter-sheet-open");

    await user.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body).not.toHaveClass("filter-sheet-open");
  });

  it("活跃筛选标签可以逐项移除，普通清除不重置年份和地区", async () => {
    window.history.replaceState(
      null,
      "",
      "/?mode=point&year=800&scope=custom&region=region-europe&q=%E5%94%90&type=mainline"
    );
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "移除搜索：唐" }));
    expect(new URLSearchParams(window.location.search).has("q")).toBe(false);
    await user.click(screen.getByRole("button", { name: "移除类别：主线王朝" }));

    let params = new URLSearchParams(window.location.search);
    expect(params.has("type")).toBe(false);
    expect(params.get("year")).toBe("800");
    expect(params.get("scope")).toBe("custom");

    await user.click(screen.getByRole("button", { name: "移除地区：欧洲" }));
    params = new URLSearchParams(window.location.search);
    expect(params.has("scope")).toBe(false);
    expect(params.get("year")).toBe("800");
    expect(screen.queryByLabelText("活跃筛选")).not.toBeInTheDocument();
  });
});
