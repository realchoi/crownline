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
  it("移动端可直接切换视图，并保留年份、地区、筛选、对比与未知参数", async () => {
    mockMobileViewport(true);
    window.history.replaceState(
      null,
      "",
      "/?mode=point&year=800&scope=china&q=唐&type=mainline&compare=polity-cn-tang&custom=keep"
    );
    const user = setupUser();
    renderApp();

    const map = screen.getByRole("button", { name: "地图" });
    await user.click(map);
    expect(map).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("dialog", { name: "筛选与呈现" })).not.toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: "当前年份历史政权示意地图" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "时间轴" }));
    expect(screen.getByRole("region", { name: "800 年时间点结果" })).toBeInTheDocument();
    const params = new URLSearchParams(window.location.search);
    expect(params.get("year")).toBe("800");
    expect(params.get("scope")).toBe("china");
    expect(params.get("q")).toBe("唐");
    expect(params.get("type")).toBe("mainline");
    expect(params.getAll("compare")).toEqual(["polity-cn-tang"]);
    expect(params.get("custom")).toBe("keep");
    expect(params.has("view")).toBe(false);

    const summary = screen.getByRole("region", { name: "当前范围和结果摘要" });
    expect(within(summary).getByRole("status")).toHaveTextContent("中国 · 800");
  });

  it("移动端外部视图按钮与筛选抽屉共享状态，关闭抽屉后可继续切换", async () => {
    mockMobileViewport(true);
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "地图" }));
    await user.click(screen.getByRole("button", { name: "筛选" }));
    const dialog = screen.getByRole("dialog", { name: "筛选与呈现" });
    expect(within(dialog).getByRole("button", { name: "地图" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(within(dialog).getByRole("button", { name: "时间轴" }));
    await user.click(within(dialog).getByRole("button", { name: "关闭筛选" }));
    expect(screen.getByRole("button", { name: "时间轴" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("全球已收录 · 全时期");
    expect(screen.queryByLabelText("当前探索状态")).not.toBeInTheDocument();
  });

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

    const user = setupUser();
    const trigger = screen.getByRole("button", { name: "展开控制台" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "筛选与呈现" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "关闭筛选" })).toHaveFocus()
    );
    await user.click(within(dialog).getByRole("button", { name: "中国" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "筛选与呈现" })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("scope")).toBe("china");
    expect(screen.getByRole("region", { name: "紧凑探索工具条" })).toHaveTextContent("中国");

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
