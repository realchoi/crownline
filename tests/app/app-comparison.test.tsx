import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CrownlineDetail } from "../../src/domain/types";
import { setupUser } from "../helpers/user";
import {
  artifacts,
  createDeferred,
  installAppTestLifecycle,
  loadGeneratedDetail,
  renderApp
} from "../helpers/renderApp";
installAppTestLifecycle();

describe("Crownline 政权对比", () => {
  it("从时间轴选择最多两个政权并同步 URL", async () => {
    const user = setupUser();
    renderApp();

    expect(screen.queryByRole("button", { name: "将春秋加入对比" })).not.toBeInTheDocument();
    const tang = screen.getByRole("button", { name: "将唐加入对比" });
    await user.click(tang);
    expect(screen.getByRole("button", { name: "将唐移出对比" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(new URLSearchParams(window.location.search).getAll("compare")).toEqual([
      "polity-cn-tang"
    ]);

    await user.click(screen.getByRole("button", { name: "将明加入对比" }));
    expect(new URLSearchParams(window.location.search).getAll("compare")).toEqual([
      "polity-cn-tang",
      "polity-cn-ming"
    ]);
    expect(screen.getByRole("button", { name: "将清加入对比" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "将唐移出对比" }));
    expect(new URLSearchParams(window.location.search).getAll("compare")).toEqual([
      "polity-cn-ming"
    ]);
    expect(screen.getByRole("button", { name: "将清加入对比" })).toBeEnabled();
  });

  it("选择一个政权后显示待完成的对比台并允许清空", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "将唐加入对比" }));
    const panel = screen.getByRole("region", { name: "政权时间对比" });
    expect(panel).toHaveTextContent("唐");
    expect(panel).toHaveTextContent("再选择一个政权");

    await user.click(within(panel).getByRole("button", { name: "清空对比" }));
    expect(screen.queryByRole("region", { name: "政权时间对比" })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("compare")).toBe(false);
  });

  it("展示多段共同存续时间并在当前交集年份并列统治者", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=705");
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "将唐加入对比" }));
    await user.click(screen.getByRole("button", { name: "将武周加入对比" }));

    const panel = screen.getByRole("region", { name: "政权时间对比" });
    expect(within(panel).getByRole("heading", { name: "唐" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "武周" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("690—690、705—705");
    expect(panel).toHaveTextContent("共同存续 2 年");
    expect(panel).toHaveTextContent("705年位于共同存续期");
    expect(await within(panel).findByText("唐中宗")).toBeInTheDocument();
    expect(within(panel).getAllByText("武则天").length).toBeGreaterThan(0);
    expect(panel).toHaveTextContent("共同存续期内已收录统治者");
  });

  it("在公元前年份使用历史纪年展示双方当年统治者", async () => {
    window.history.replaceState(
      null,
      "",
      "/?mode=point&year=-221&compare=polity-cn-qin&compare=polity-maurya-empire"
    );
    renderApp();

    const panel = screen.getByRole("region", { name: "政权时间对比" });
    expect(await within(panel).findByText("秦始皇")).toBeInTheDocument();
    expect(panel).toHaveTextContent("前221年统治者");
    expect(panel).not.toHaveTextContent("-221年统治者");
  });

  it("对比详情加载失败后可以重试", async () => {
    window.history.replaceState(
      null,
      "",
      "/?mode=point&year=705&compare=polity-cn-tang&compare=polity-cn-wu-zhou"
    );
    let tangAttempts = 0;
    const user = setupUser();
    renderApp(async (entityId) => {
      if (entityId === "polity-cn-tang") {
        tangAttempts += 1;
        if (tangAttempts === 1) throw new Error("对比详情网络错误");
      }
      return artifacts.details.get(entityId) ?? null;
    });

    const panel = screen.getByRole("region", { name: "政权时间对比" });
    const alert = await within(panel).findByRole("alert");
    expect(alert).toHaveTextContent("唐");
    expect(alert).toHaveTextContent("对比详情网络错误");
    await user.click(within(panel).getByRole("button", { name: "重新加载对比详情" }));

    expect(await within(panel).findByText("唐中宗")).toBeInTheDocument();
    expect(tangAttempts).toBe(2);
  });

  it("没有时间交集时不把资料缺失解释为没有历史关系", () => {
    window.history.replaceState(null, "", "/?compare=polity-cn-qin&compare=polity-cn-ming");
    renderApp();

    const panel = screen.getByRole("region", { name: "政权时间对比" });
    expect(panel).toHaveTextContent("存续时间没有重叠");
    expect(panel).toHaveTextContent("这不表示双方没有历史关系");
  });

  it("把有来源的战争与相关事件显示在独立历史关系区块", async () => {
    window.history.replaceState(
      null,
      "",
      "/?compare=polity-byzantine-empire&compare=polity-seljuk-empire"
    );
    renderApp();

    const panel = screen.getByRole("region", { name: "政权时间对比" });
    const relationships = await within(panel).findByRole("region", {
      name: "已校订历史关系"
    });
    expect(panel).toHaveTextContent("共同存在区间");
    expect(relationships).toHaveTextContent("战争");
    expect(relationships).toHaveTextContent("曼齐克特");
    expect(relationships).toHaveTextContent("1071");
    expect(relationships).toHaveTextContent("拜占庭帝国 · 交战方");
    expect(relationships).toHaveTextContent("塞尔柱帝国 · 交战方");
    expect(relationships).toHaveTextContent("高可信度");
    expect(relationships).toHaveTextContent("相关事件");
    expect(within(relationships).getByRole("link", { name: /查看来源/ })).toHaveAttribute(
      "target",
      "_blank"
    );
  });

  it("为北宋与金展示宋金联盟及海上之盟", async () => {
    window.history.replaceState(
      null,
      "",
      "/?compare=polity-cn-jin&compare=polity-cn-northern-song"
    );
    renderApp();

    const relationships = await screen.findByRole("region", { name: "已校订历史关系" });
    expect(relationships).toHaveTextContent("联盟");
    expect(relationships).toHaveTextContent("海上之盟");
    expect(relationships).toHaveTextContent("金 · 盟约方");
    expect(relationships).toHaveTextContent("北宋 · 盟约方");
  });

  it("同一政权对按类型展示多条关系及其口径说明", async () => {
    window.history.replaceState(null, "", "/?compare=polity-cn-tang&compare=polity-balhae");
    renderApp();

    const relationships = await screen.findByRole("region", { name: "已校订历史关系" });
    expect(relationships).toHaveTextContent("朝贡");
    expect(relationships).toHaveTextContent("文化交流");
    expect(relationships).toHaveTextContent("存在争议");
    expect(relationships).toHaveTextContent("不据此把渤海解释为唐的地方行政单位");
    expect(relationships).toHaveTextContent("不表示双方文化同一");
    expect(within(relationships).getAllByText(/来源 · 1 项/)).toHaveLength(2);
  });

  it("没有匹配关系时只说明尚未校订", async () => {
    window.history.replaceState(null, "", "/?compare=polity-cn-qin&compare=polity-cn-ming");
    renderApp();

    const relationships = await screen.findByRole("region", { name: "已校订历史关系" });
    expect(relationships).toHaveTextContent("暂无已校订关系数据");
    expect(relationships).toHaveTextContent("不代表双方历史上没有关系");
  });

  it("单条坏关系只产生提示，不破坏有效关系与统治者", async () => {
    window.history.replaceState(
      null,
      "",
      "/?compare=polity-byzantine-empire&compare=polity-seljuk-empire"
    );
    renderApp(async (entityId) => {
      const detail = artifacts.details.get(entityId);
      if (!detail) return null;
      const copy = structuredClone(detail);
      if (entityId === "polity-byzantine-empire") {
        copy.relationships.push({ broken: true } as never);
      }
      return copy;
    });

    const relationships = await screen.findByRole("region", { name: "已校订历史关系" });
    expect(relationships).toHaveTextContent("曼齐克特");
    expect(relationships).toHaveTextContent("有 1 条关系数据格式异常，已跳过");
    expect(screen.getByRole("region", { name: "政权时间对比" })).toHaveTextContent("罗曼努斯四世");
  });

  it("切换对比政权后忽略旧详情请求的迟到错误", async () => {
    window.history.replaceState(null, "", "/?compare=polity-cn-tang&compare=polity-cn-wu-zhou");
    const tang = createDeferred<CrownlineDetail | null>();
    const wuZhou = createDeferred<CrownlineDetail | null>();
    const user = setupUser();
    renderApp((entityId) => {
      if (entityId === "polity-cn-tang") return tang.promise;
      if (entityId === "polity-cn-wu-zhou") return wuZhou.promise;
      return loadGeneratedDetail(entityId);
    });

    let panel = screen.getByRole("region", { name: "政权时间对比" });
    await user.click(within(panel).getByRole("button", { name: "从对比中移除唐" }));
    await user.click(within(panel).getByRole("button", { name: "从对比中移除武周" }));
    await user.click(screen.getByRole("button", { name: "将明加入对比" }));
    await user.click(screen.getByRole("button", { name: "将清加入对比" }));

    panel = screen.getByRole("region", { name: "政权时间对比" });
    expect(await within(panel).findByText("崇祯帝")).toBeInTheDocument();
    tang.reject(new Error("已经失效的旧请求"));
    wuZhou.resolve(artifacts.details.get("polity-cn-wu-zhou") ?? null);

    await waitFor(() => {
      expect(within(panel).queryByText("已经失效的旧请求")).not.toBeInTheDocument();
      expect(within(panel).getByRole("heading", { name: "明" })).toBeInTheDocument();
      expect(within(panel).getByRole("heading", { name: "清" })).toBeInTheDocument();
    });
  });
});
