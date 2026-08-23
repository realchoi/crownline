import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GeographyLoadResult } from "../../src/data/loadCrownlineGeography";
import { setupUser } from "../helpers/user";
import {
  artifacts,
  createDeferred,
  findMapMarker,
  installAppTestLifecycle,
  loadGeneratedDetail,
  loadGeneratedGeography,
  renderApp
} from "../helpers/renderApp";
installAppTestLifecycle();

describe("Crownline 地图", () => {
  it("默认展示全时期点位，调整年份后筛选并可返回总览", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "地图" }));
    expect(
      await screen.findByRole("region", { name: "全时期历史政权总览地图" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("地图范围")).toHaveTextContent("全时期总览");
    expect(screen.getByText(/全时期总览：显示/)).toBeInTheDocument();
    expect(screen.getByText("跨时期点位不表示这些政权同时存在")).toBeInTheDocument();

    const overviewList = screen.getByRole("region", { name: "地图结果列表" });
    expect(
      within(overviewList).getByRole("button", { name: "明，南京，都城" })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "历史年份滑杆，拖动后按年份显示" }), {
      target: { value: "500" }
    });
    expect(await screen.findByRole("region", { name: "当前年份历史政权示意地图" })).toBeVisible();
    expect(screen.getByLabelText("当前年份")).toHaveTextContent("500");
    expect(screen.getByRole("region", { name: "地图结果列表" })).not.toHaveTextContent("明");
    expect(new URLSearchParams(window.location.search).get("mode")).toBe("point");

    await user.click(screen.getByRole("button", { name: "返回全时期总览" }));
    expect(await screen.findByRole("region", { name: "全时期历史政权总览地图" })).toBeVisible();
    expect(new URLSearchParams(window.location.search).has("mode")).toBe(false);
    expect(new URLSearchParams(window.location.search).has("year")).toBe(false);

    const restoredList = screen.getByRole("region", { name: "地图结果列表" });
    await user.click(within(restoredList).getByRole("button", { name: "明，南京，都城" }));
    expect(await screen.findByRole("heading", { name: "统治序列" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /500年 · 在位统治者/ })).not.toBeInTheDocument();
  });

  it("首次进入地图时按需加载地理数据并显示当年点位", async () => {
    window.history.replaceState(null, "", "/?view=map&year=450");
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      return loadGeneratedGeography();
    });

    expect(await findMapMarker("北魏，平城，都城")).toBeInTheDocument();
    expect(attempts).toBe(1);
  });

  it("在迁都边界年份显示正确的新增中国点位", async () => {
    window.history.replaceState(null, "", "/?view=map&year=319&q=汉赵");
    renderApp();

    expect(await findMapMarker("汉赵（前赵），长安，都城")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "地图结果列表" })).not.toHaveTextContent(
      "汉赵（前赵），平阳"
    );
  });

  it("地图成功加载后切换视图复用缓存", async () => {
    window.history.replaceState(null, "", "/?view=map&year=450");
    const user = setupUser();
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      return loadGeneratedGeography();
    });

    expect(await findMapMarker("北魏，平城，都城")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "时间轴" }));
    await user.click(screen.getByRole("button", { name: "地图" }));

    expect(await findMapMarker("北魏，平城，都城")).toBeInTheDocument();
    expect(attempts).toBe(1);
  });

  it("地理数据加载失败后可以重试", async () => {
    window.history.replaceState(null, "", "/?view=map&year=450");
    const user = setupUser();
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("无法加载地理数据（HTTP 503）");
      return loadGeneratedGeography();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载地理数据（HTTP 503）");
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await findMapMarker("北魏，平城，都城")).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("离开后重新进入地图时忽略旧请求的迟到错误", async () => {
    window.history.replaceState(null, "", "/?view=map&year=450");
    const user = setupUser();
    const first = createDeferred<GeographyLoadResult>();
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      return attempts === 1 ? first.promise : loadGeneratedGeography();
    });

    expect(await screen.findByText("正在加载地理数据…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "时间轴" }));
    await user.click(screen.getByRole("button", { name: "地图" }));
    expect(await findMapMarker("北魏，平城，都城")).toBeInTheDocument();

    first.reject(new Error("已经失效的旧地理请求"));
    await waitFor(() => {
      expect(screen.queryByText("已经失效的旧地理请求")).not.toBeInTheDocument();
      expect(
        within(
          screen.getByRole("region", {
            name: "当前年份历史政权示意地图"
          })
        ).getByRole("button", { name: "北魏，平城，都城" })
      ).toBeInTheDocument();
    });
    expect(attempts).toBe(2);
  });

  it("地图明确说明历史分期类别不会成为地理点位", async () => {
    window.history.replaceState(null, "", "/?view=map&year=-770&type=context");
    renderApp();

    expect(await screen.findByText("历史分期不进入地图；请选择真实政权类别。")).toBeInTheDocument();
  });

  it("地图标记打开既有详情，结果列表可选择两个政权对比", async () => {
    window.history.replaceState(null, "", "/?view=map&year=1400");
    const user = setupUser();
    renderApp();

    const map = await screen.findByRole("region", { name: "当前年份历史政权示意地图" });
    let mingMarker: HTMLElement | null = null;
    for (const trigger of within(map).getAllByRole("button", { name: /此处有 \d+ 个历史点位/ })) {
      await user.click(trigger);
      mingMarker = within(map).queryByRole("button", { name: "明，南京，都城" });
      if (mingMarker) break;
    }
    expect(mingMarker).not.toBeNull();
    await user.click(mingMarker!);
    const dialog = screen.getByRole("dialog", { name: "明" });
    expect(dialog).toHaveTextContent("1368—1644");
    await user.click(within(dialog).getByRole("button", { name: "关闭详情" }));
    await user.click(screen.getByRole("button", { name: "全球已收录" }));

    const list = screen.getByRole("region", { name: "地图结果列表" });
    await user.click(within(list).getByRole("button", { name: "将明加入对比" }));
    await user.click(within(list).getByRole("button", { name: /^将帖木儿帝国.*加入对比$/ }));
    expect(new URLSearchParams(window.location.search).getAll("compare")).toEqual([
      "polity-cn-ming",
      "polity-timurid-empire"
    ]);
  });

  it("跳过异常地理记录时保留有效点位并显示警告", async () => {
    window.history.replaceState(null, "", "/?view=map&year=450");
    renderApp(loadGeneratedDetail, async () => ({
      geography: artifacts.geography,
      omittedCount: 1
    }));

    expect(await findMapMarker("北魏，平城，都城")).toBeInTheDocument();
    expect(screen.getByText("有 1 条地理记录格式异常，已跳过。")).toBeInTheDocument();
  });
});
