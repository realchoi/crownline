import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CrownlineDetail } from "../../src/domain/types";
import { setupUser } from "../helpers/user";
import {
  artifacts,
  createDeferred,
  installAppTestLifecycle,
  renderApp
} from "../helpers/renderApp";
installAppTestLifecycle();

describe("Crownline 详情", () => {
  it("为中断政权绘制多个时间条，并在详情计算实际总时长", async () => {
    const user = setupUser();
    renderApp();
    const westernQinBars = screen.getAllByRole("button", { name: /^西秦，/ });

    expect(westernQinBars).toHaveLength(2);
    await user.click(westernQinBars[0]!);

    const dialog = screen.getByRole("dialog", { name: "西秦" });
    expect(within(dialog).getByText("385—400、409—431")).toBeInTheDocument();
    expect(within(dialog).getByText("约 39 年")).toBeInTheDocument();

    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "西秦" })).not.toBeInTheDocument();
    await waitFor(() => expect(westernQinBars[0]).toHaveFocus());
  });

  it("在历史分期详情中保留虚线视觉语义", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: /春秋.*历史分期/ }));

    const dialog = screen.getByRole("dialog", { name: "春秋" });
    const badge = within(dialog).getByText("历史分期");
    expect(getComputedStyle(badge).borderStyle).toBe("dashed");
  });

  it("浏览器支持时以原生模态方式打开详情", async () => {
    const user = setupUser();
    const showModal = vi.fn(function openModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal
    });

    renderApp();
    await user.click(screen.getAllByRole("button", { name: /^西秦，/ })[0]!);

    expect(showModal).toHaveBeenCalledOnce();
  });

  it("在时间点详情展示单一在位统治者、完整任期和来源", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400");
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: /^明，/ }));

    const dialog = screen.getByRole("dialog", { name: "明" });
    expect(
      within(dialog).getByRole("heading", { name: "1400年 · 在位统治者" })
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "建文帝" })).toBeInTheDocument();
    expect(within(dialog).getByText("1398—1402")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /中国历代帝王年表/ })).toHaveAttribute(
      "target",
      "_blank"
    );
  });

  it("同年展示皇帝与两位摄政者且不误标争议", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1862");
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: /^清，/ }));

    const dialog = screen.getByRole("dialog", { name: "清" });
    expect(within(dialog).getByRole("heading", { name: "同治帝" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "慈安太后" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "慈禧太后" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("摄政者")).toHaveLength(2);
    expect(within(dialog).queryByText("存在争议")).not.toBeInTheDocument();
  });

  it("明确披露早期王年争议", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=-2070");
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: /^夏，/ }));

    const dialog = screen.getByRole("dialog", { name: "夏" });
    expect(within(dialog).getByText("存在争议")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "夏禹" })).toBeInTheDocument();
    expect(within(dialog).getByText(/完整任期无法可靠核定/)).toBeInTheDocument();
  });

  it("区分明确空位和资料尚未校订", async () => {
    const user = setupUser();
    window.history.replaceState(null, "", "/?mode=point&year=-840");
    const firstRender = renderApp();

    await user.click(screen.getByRole("button", { name: /^西周，/ }));
    expect(
      within(screen.getByRole("dialog", { name: "西周" })).getByText("已有资料记为空位期")
    ).toBeInTheDocument();

    firstRender.unmount();
    window.history.replaceState(null, "", "/?mode=point&year=312");
    renderApp();
    await user.click(screen.getByRole("button", { name: /^西晋，/ }));

    const dialog = screen.getByRole("dialog", { name: "西晋" });
    expect(within(dialog).getByText("这一年的统治者资料尚未校订")).toBeInTheDocument();
    expect(within(dialog).getByText(/不等于当时无人统治/)).toBeInTheDocument();
  });

  it("全览详情不使用隐藏年份且历史分期不显示统治者区域", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: /明，1368—1644/ }));
    const mingDialog = screen.getByRole("dialog", { name: "明" });
    expect(within(mingDialog).getByText(/切换到时间点模式/)).toBeInTheDocument();
    expect(within(mingDialog).queryByText(/1912年 · 在位统治者/)).not.toBeInTheDocument();
    await user.click(within(mingDialog).getByRole("button", { name: "关闭详情" }));

    await user.click(screen.getByRole("button", { name: /春秋.*历史分期/ }));
    expect(
      within(screen.getByRole("dialog", { name: "春秋" })).queryByText(/在位统治者/)
    ).not.toBeInTheDocument();
  });

  it("打开详情时立即显示基础信息并在数据到达后展示统治者", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400");
    const deferred = createDeferred<CrownlineDetail | null>();
    const user = setupUser();
    renderApp(() => deferred.promise);

    await user.click(screen.getByRole("button", { name: /^明，/ }));
    const dialog = screen.getByRole("dialog", { name: "明" });
    expect(within(dialog).getByText("正在加载详情")).toBeInTheDocument();
    expect(within(dialog).getByText("1368—1644")).toBeInTheDocument();

    deferred.resolve(artifacts.details.get("polity-cn-ming") ?? null);
    expect(await within(dialog).findByRole("heading", { name: "建文帝" })).toBeInTheDocument();
    expect(within(dialog).queryByText("正在加载详情")).not.toBeInTheDocument();
  });

  it("详情请求失败后可以在弹窗内重试", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400");
    let attempts = 0;
    const user = setupUser();
    renderApp(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("临时网络错误");
      return artifacts.details.get("polity-cn-ming") ?? null;
    });

    await user.click(screen.getByRole("button", { name: /^明，/ }));
    const dialog = screen.getByRole("dialog", { name: "明" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("临时网络错误");
    await user.click(within(dialog).getByRole("button", { name: "重新加载" }));

    expect(await within(dialog).findByRole("heading", { name: "建文帝" })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("实体没有详情包时显示明确空状态", async () => {
    const user = setupUser();
    renderApp(async () => null);

    await user.click(screen.getByRole("button", { name: /春秋.*历史分期/ }));

    expect(
      await within(screen.getByRole("dialog", { name: "春秋" })).findByText("暂无已整理详情")
    ).toBeInTheDocument();
  });

  it("关闭详情后忽略迟到的旧请求结果", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400");
    const deferred = createDeferred<CrownlineDetail | null>();
    const user = setupUser();
    renderApp(() => deferred.promise);

    await user.click(screen.getByRole("button", { name: /^明，/ }));
    await user.click(
      within(screen.getByRole("dialog", { name: "明" })).getByRole("button", {
        name: "关闭详情"
      })
    );
    deferred.resolve(artifacts.details.get("polity-cn-ming") ?? null);

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "明" })).not.toBeInTheDocument()
    );
  });

  it("从 URL 恢复详情深链接", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400&detail=polity-cn-ming");
    renderApp();

    const dialog = screen.getByRole("dialog", { name: "明" });
    expect(within(dialog).getByText("1368—1644")).toBeInTheDocument();
    expect(await within(dialog).findByRole("heading", { name: "建文帝" })).toBeInTheDocument();
  });

  it("打开和关闭详情时同步 detail 参数", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: /明，1368—1644/ }));
    expect(new URLSearchParams(window.location.search).get("detail")).toBe("polity-cn-ming");

    await user.click(
      within(screen.getByRole("dialog", { name: "明" })).getByRole("button", {
        name: "关闭详情"
      })
    );
    expect(new URLSearchParams(window.location.search).has("detail")).toBe(false);
  });

  it("浏览器后退和前进导航详情开关", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: /明，1368—1644/ }));
    expect(screen.getByRole("dialog", { name: "明" })).toBeInTheDocument();

    window.history.back();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "明" })).not.toBeInTheDocument();
    });

    window.history.forward();
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "明" })).toBeInTheDocument();
    });
  });
});
