import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "../helpers/user";
import {
  artifacts,
  installAppTestLifecycle,
  loadGeneratedDetail,
  renderApp
} from "../helpers/renderApp";

installAppTestLifecycle();

describe("从详情发现历史关系", () => {
  it("仅用当前详情发现全时期关联对象，显示类型、年代和原名", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1271&q=元&detail=polity-cn-yuan");
    const loader = vi.fn(loadGeneratedDetail);
    renderApp(loader);

    const dialog = screen.getByRole("dialog", { name: "元" });
    const related = await within(dialog).findByRole("region", { name: "相关政权" });
    const records = within(related).getByRole("list", { name: "素可泰王国的已校订关系" });
    expect(records).toHaveTextContent("朝贡");
    expect(records).toHaveTextContent("文化交流");
    expect(records).toHaveTextContent("1292—1323");
    expect(
      within(related).getAllByRole("button", { name: "进入对比：元与素可泰王国" })
    ).toHaveLength(1);
    expect(within(related).getByText("สุโขทัย")).toHaveAttribute("lang", "th");
    expect(within(related).getByText("สุโขทัย")).toHaveAttribute("dir", "auto");
    expect(related).toHaveTextContent("全时期已校订关系");
    expect(loader).toHaveBeenCalledExactlyOnceWith("polity-cn-yuan");
  });

  it("替换已满对比并聚焦对比工具，保留地图和筛选、支持后退前进及刷新", async () => {
    window.history.replaceState(
      null,
      "",
      "/?view=map&mode=point&year=1292&scope=china&q=元&type=mainline&layer=combined&custom=keep&detail=polity-cn-yuan&compare=polity-cn-ming&compare=polity-cn-qing#main-content"
    );
    const user = setupUser();
    const app = renderApp();
    const before = new URL(window.location.href);
    const related = await within(screen.getByRole("dialog", { name: "元" })).findByRole("region", {
      name: "相关政权"
    });
    await user.click(within(related).getByRole("button", { name: "进入对比：元与素可泰王国" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "政权时间对比" });
    const relationships = await within(panel).findByRole("region", { name: "已校订历史关系" });
    expect(relationships).toHaveTextContent("元与素可泰使节和工艺交流");
    expect(within(relationships).getAllByRole("link", { name: /查看来源/ }).length).toBeGreaterThan(
      0
    );
    await waitFor(() =>
      expect(screen.getByRole("complementary", { name: "对比工具" })).toHaveFocus()
    );
    const after = new URL(window.location.href);
    expect(after.searchParams.getAll("compare")).toEqual([
      "polity-cn-yuan",
      "polity-sukhothai-kingdom"
    ]);
    expect(after.searchParams.has("detail")).toBe(false);
    for (const key of ["view", "mode", "year", "scope", "q", "type", "layer", "custom"]) {
      expect(after.searchParams.get(key)).toBe(before.searchParams.get(key));
    }
    expect(after.hash).toBe(before.hash);

    window.history.back();
    await screen.findByRole("dialog", { name: "元" });
    expect(new URLSearchParams(window.location.search).getAll("compare")).toEqual([
      "polity-cn-ming",
      "polity-cn-qing"
    ]);
    window.history.forward();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.href).toBe(after.href);
    app.unmount();
    renderApp();
    expect(await screen.findByRole("region", { name: "已校订历史关系" })).toHaveTextContent("朝贡");
    expect(new URLSearchParams(window.location.search).getAll("compare")).toEqual([
      "polity-cn-yuan",
      "polity-sukhothai-kingdom"
    ]);
  });

  it("没有关系时保留未知语义，历史分期不显示关系入口", async () => {
    window.history.replaceState(null, "", "/?detail=polity-cn-xia");
    const app = renderApp();
    const related = await screen.findByRole("region", { name: "相关政权" });
    expect(related).toHaveTextContent("暂无已校订关系数据");
    expect(related).toHaveTextContent("不代表历史上没有相关政权或关系");
    expect(within(related).queryByRole("button")).not.toBeInTheDocument();
    app.unmount();
    window.history.replaceState(null, "", "/?detail=period-cn-spring-autumn");
    renderApp();
    const dialog = screen.getByRole("dialog", { name: "春秋" });
    expect(await within(dialog).findByRole("heading", { name: "资料来源" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("region", { name: "相关政权" })).not.toBeInTheDocument();
  });

  it("详情失败重试后展示入口，单条坏关系不破坏其他关系和统治者", async () => {
    window.history.replaceState(null, "", "/?detail=polity-cn-yuan");
    const user = setupUser();
    let attempts = 0;
    renderApp(async (id) => {
      if (++attempts === 1) throw new Error("临时网络错误");
      const detail = structuredClone(artifacts.details.get(id)!);
      detail.relationships.push({ broken: true } as never);
      return detail;
    });
    const dialog = screen.getByRole("dialog", { name: "元" });
    await within(dialog).findByRole("alert");
    expect(within(dialog).queryByRole("region", { name: "相关政权" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "重新加载" }));
    const related = await within(dialog).findByRole("region", { name: "相关政权" });
    expect(within(related).getByRole("status")).toHaveTextContent(
      "有 1 条关系数据格式异常，已跳过"
    );
    expect(within(related).getByRole("button", { name: "进入对比：元与素可泰王国" })).toBeEnabled();
    expect(within(dialog).getByRole("region", { name: "统治序列" })).toBeInTheDocument();
  });
});
