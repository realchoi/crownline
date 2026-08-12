import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/app/App";
import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import type {
  CrownlineGeographyLoader,
  GeographyLoadResult
} from "../src/data/loadCrownlineGeography";
import type { CrownlineDetail } from "../src/domain/types";
import "../src/styles/styles.css";

const data = await loadSourceData();
const artifacts = buildGeneratedArtifacts(data);
const loadGeneratedDetail = async (entityId: string) => artifacts.details.get(entityId) ?? null;
const loadGeneratedGeography = async (): Promise<GeographyLoadResult> => ({
  geography: artifacts.geography,
  omittedCount: 0
});
const renderApp = (
  loadDetail: (entityId: string) => Promise<CrownlineDetail | null> = loadGeneratedDetail,
  loadGeography: CrownlineGeographyLoader = loadGeneratedGeography
) => render(
  <App data={artifacts.index} loadDetail={loadDetail} loadGeography={loadGeography} />
);

async function findMapMarker(name: string): Promise<HTMLButtonElement> {
  const map = await screen.findByRole("region", {
    name: "当前年份历史政权示意地图"
  });
  return within(map).getByRole("button", { name });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  if (showModalDescriptor) {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalDescriptor);
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  }
});

describe("Crownline 时间轴", () => {
  it("初始展示全部七十三个实体和七个阶段", () => {
    renderApp();

    expect(screen.getByText("显示 73 / 73 个条目，涉及 7 个历史阶段")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crownline · 王冠纪" })).toBeInTheDocument();
    expect(screen.getByLabelText("地区范围")).toBeInTheDocument();
  });

  it("从时间轴选择最多两个政权并同步 URL", async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    window.history.replaceState(
      null,
      "",
      "/?compare=polity-cn-qin&compare=polity-cn-ming"
    );
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
    expect(within(relationships).getByRole("link", { name: /查看来源/ }))
      .toHaveAttribute("target", "_blank");
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
    window.history.replaceState(
      null,
      "",
      "/?compare=polity-cn-tang&compare=polity-balhae"
    );
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
    window.history.replaceState(
      null,
      "",
      "/?compare=polity-cn-qin&compare=polity-cn-ming"
    );
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
    expect(screen.getByRole("region", { name: "政权时间对比" }))
      .toHaveTextContent("罗曼努斯四世");
  });

  it("切换对比政权后忽略旧详情请求的迟到错误", async () => {
    window.history.replaceState(
      null,
      "",
      "/?compare=polity-cn-tang&compare=polity-cn-wu-zhou"
    );
    const tang = createDeferred<CrownlineDetail | null>();
    const wuZhou = createDeferred<CrownlineDetail | null>();
    const user = userEvent.setup();
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

  it("按名称或别名搜索并支持空结果", async () => {
    const user = userEvent.setup();
    renderApp();
    const search = screen.getByRole("searchbox", { name: "搜索名称、别名、年份或说明" });

    await user.type(search, "殷商");
    expect(screen.getByText("显示 1 / 73 个条目，涉及 1 个历史阶段")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "不存在的政权");
    expect(screen.getByRole("region", { name: "中国历代王朝时间轴" })).toHaveTextContent(
      "没有找到匹配条目。"
    );
  });

  it("按展示类别筛选并清除筛选", async () => {
    const user = userEvent.setup();
    renderApp();
    const select = screen.getByRole("combobox", { name: "显示类别" });

    await user.selectOptions(select, "context");
    expect(screen.getByText("显示 2 / 73 个条目，涉及 1 个历史阶段")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByText("显示 73 / 73 个条目，涉及 7 个历史阶段")).toBeInTheDocument();
    expect(select).toHaveValue("all");
  });

  it("从 URL 恢复并同步搜索与类别状态", async () => {
    window.history.replaceState(null, "", "/?q=时期&type=context");
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByRole("searchbox")).toHaveValue("时期");
    expect(screen.getByRole("combobox")).toHaveValue("context");
    expect(screen.getByText("显示 2 / 73 个条目，涉及 1 个历史阶段")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "all");
    expect(new URLSearchParams(window.location.search).has("type")).toBe(false);
  });

  it("为中断政权绘制多个时间条，并在详情计算实际总时长", async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /春秋.*历史分期/ }));

    const dialog = screen.getByRole("dialog", { name: "春秋" });
    const badge = within(dialog).getByText("历史分期");
    expect(getComputedStyle(badge).borderStyle).toBe("dashed");
  });

  it("浏览器支持时以原生模态方式打开详情", async () => {
    const user = userEvent.setup();
    const showModal = vi.fn(function openModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
    });

    renderApp();
    await user.click(screen.getAllByRole("button", { name: /^西秦，/ })[0]!);

    expect(showModal).toHaveBeenCalledOnce();
  });

  it("在全览和时间点模式间切换并同步 URL", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "时间点" }));

    expect(screen.getByRole("region", { name: "1922 年时间点结果" })).toHaveTextContent(
      "1922年 · 当时存在"
    );
    expect(screen.getByLabelText("当前年份")).toHaveTextContent("1922");
    expect(new URLSearchParams(window.location.search).get("mode")).toBe("point");

    await user.click(screen.getByRole("button", { name: "全览" }));
    expect(screen.getByRole("region", { name: "中国历代王朝时间轴" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("mode")).toBe(false);
  });

  it("切换地图时保留年份控件并在返回时间轴后恢复原浏览模式", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "时间点" }));
    await user.click(screen.getByRole("button", { name: "地图" }));

    expect(screen.getByLabelText("当前年份")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "时间点" })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("view")).toBe("map");

    await user.click(screen.getByRole("button", { name: "时间轴" }));

    expect(screen.getByRole("button", { name: "时间点" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("region", { name: "1922 年时间点结果" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("view")).toBe(false);
  });

  it("首次进入地图时按需加载地理数据并显示当年点位", async () => {
    window.history.replaceState(null, "", "/?view=map&year=500");
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      return loadGeneratedGeography();
    });

    expect(await findMapMarker("北魏，洛阳，都城")).toBeInTheDocument();
    expect(attempts).toBe(1);
  });

  it("地图成功加载后切换视图复用缓存", async () => {
    window.history.replaceState(null, "", "/?view=map&year=500");
    const user = userEvent.setup();
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      return loadGeneratedGeography();
    });

    expect(await findMapMarker("北魏，洛阳，都城")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "时间轴" }));
    await user.click(screen.getByRole("button", { name: "地图" }));

    expect(await findMapMarker("北魏，洛阳，都城")).toBeInTheDocument();
    expect(attempts).toBe(1);
  });

  it("地理数据加载失败后可以重试", async () => {
    window.history.replaceState(null, "", "/?view=map&year=500");
    const user = userEvent.setup();
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("无法加载地理数据（HTTP 503）");
      return loadGeneratedGeography();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载地理数据（HTTP 503）");
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await findMapMarker("北魏，洛阳，都城")).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("离开后重新进入地图时忽略旧请求的迟到错误", async () => {
    window.history.replaceState(null, "", "/?view=map&year=500");
    const user = userEvent.setup();
    const first = createDeferred<GeographyLoadResult>();
    let attempts = 0;
    renderApp(loadGeneratedDetail, async () => {
      attempts += 1;
      return attempts === 1 ? first.promise : loadGeneratedGeography();
    });

    expect(await screen.findByText("正在加载地理数据…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "时间轴" }));
    await user.click(screen.getByRole("button", { name: "地图" }));
    expect(await findMapMarker("北魏，洛阳，都城")).toBeInTheDocument();

    first.reject(new Error("已经失效的旧地理请求"));
    await waitFor(() => {
      expect(screen.queryByText("已经失效的旧地理请求")).not.toBeInTheDocument();
      expect(within(screen.getByRole("region", {
        name: "当前年份历史政权示意地图"
      })).getByRole("button", { name: "北魏，洛阳，都城" })).toBeInTheDocument();
    });
    expect(attempts).toBe(2);
  });

  it("地图明确说明历史分期类别不会成为地理点位", async () => {
    window.history.replaceState(null, "", "/?view=map&year=-770&type=context");
    renderApp();

    expect(await screen.findByText("历史分期不进入地图；请选择真实政权类别。"))
      .toBeInTheDocument();
  });

  it("地图标记打开既有详情，结果列表可选择两个政权对比", async () => {
    window.history.replaceState(null, "", "/?view=map&year=1400");
    const user = userEvent.setup();
    renderApp();

    await user.click(await findMapMarker("明，南京，都城"));
    const dialog = screen.getByRole("dialog", { name: "明" });
    expect(dialog).toHaveTextContent("1368—1644");
    await user.click(within(dialog).getByRole("button", { name: "关闭详情" }));
    await user.click(screen.getByRole("button", { name: "全球已收录" }));

    const list = screen.getByRole("region", { name: "地图结果列表" });
    await user.click(within(list).getByRole("button", { name: "将明加入对比" }));
    await user.click(within(list).getByRole("button", { name: "将帖木儿帝国加入对比" }));
    expect(new URLSearchParams(window.location.search).getAll("compare")).toEqual([
      "polity-cn-ming",
      "polity-timurid-empire"
    ]);
  });

  it("跳过异常地理记录时保留有效点位并显示警告", async () => {
    window.history.replaceState(null, "", "/?view=map&year=500");
    renderApp(loadGeneratedDetail, async () => ({
      geography: artifacts.geography,
      omittedCount: 1
    }));

    expect(await findMapMarker("北魏，洛阳，都城")).toBeInTheDocument();
    expect(screen.getByText("有 1 条地理记录格式异常，已跳过。")).toBeInTheDocument();
  });

  it("在时间点模式切换全球已收录并同步覆盖说明与 URL", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "时间点" }));
    await user.click(screen.getByRole("button", { name: "全球已收录" }));

    expect(new URLSearchParams(window.location.search).get("scope")).toBe("global");
    expect(screen.getByLabelText("地区范围")).toHaveTextContent("当前数据集中的全部已收录条目");
  });

  it("从 URL 恢复自选地区并把覆盖有限与历史不存在区分开", () => {
    window.history.replaceState(
      null,
      "",
      "/?mode=point&year=1000&scope=custom&region=region-americas"
    );
    renderApp();

    expect(screen.getByRole("button", { name: "自选地区" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "美洲" })).toBeChecked();
    expect(screen.getByRole("region", { name: "当时存在的政权" })).toHaveTextContent(
      "当前数据覆盖有限，不表示当时不存在政权"
    );
  });

  it("在全览与时间点之间切换时保持全球范围", async () => {
    window.history.replaceState(null, "", "/?mode=point&scope=global");
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "全览" }));

    expect(new URLSearchParams(window.location.search).get("scope")).toBe("global");
    expect(screen.getByRole("button", { name: "全球已收录" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("region", { name: "多地区完整时间轴" })).toBeInTheDocument();
  });

  it("从 URL 恢复全球全览并去重展示跨地区实体", () => {
    window.history.replaceState(null, "", "/?scope=global");
    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("显示 93 / 93 个条目");
    expect(screen.getByRole("heading", { name: "跨地区政权" })).toBeInTheDocument();
    expect(screen.getAllByText("拜占庭帝国")).toHaveLength(1);
    expect(screen.getAllByText("阿拔斯哈里发")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^神圣罗马帝国，/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^朱罗帝国，/ })).toBeInTheDocument();
  });

  it("自选地区展示新增全球样本地区复选框", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "自选地区" }));

    expect(screen.getByRole("checkbox", { name: "东南亚" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "中亚" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "西非" })).toBeInTheDocument();
  });

  it("多地区全览使用单一共享刻度并按真实时长绘制政权", () => {
    window.history.replaceState(
      null,
      "",
      "/?scope=custom&region=region-south-asia&region=region-europe"
    );
    renderApp();

    expect(screen.getAllByRole("img", { name: "统一时间刻度：前322—1922，中点801" }))
      .toHaveLength(1);

    const cholaBar = screen.getByRole("button", { name: /^朱罗帝国，/ });
    const holyRomanEmpireBar = screen.getByRole("button", { name: /^神圣罗马帝国，/ });
    expect(Number.parseFloat(cholaBar.style.left)).toBeCloseTo(52.21, 1);
    expect(Number.parseFloat(cholaBar.style.width)).toBeCloseTo(19.13, 1);
    expect(Number.parseFloat(holyRomanEmpireBar.style.left)).toBeCloseTo(57.2, 1);
    expect(Number.parseFloat(holyRomanEmpireBar.style.width)).toBeCloseTo(37.63, 1);
  });

  it("自选多地区在两种浏览模式间保持并同步 URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/?scope=custom&region=region-europe&region=region-west-asia"
    );
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByRole("checkbox", { name: "欧洲" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "西亚" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "时间点" }));
    await user.click(screen.getByRole("button", { name: "全览" }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get("scope")).toBe("custom");
    expect(params.getAll("region")).toEqual(["region-europe", "region-west-asia"]);
    expect(screen.getByRole("checkbox", { name: "欧洲" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "西亚" })).toBeChecked();
  });

  it("美洲全览在补样后展示两个代表政权而不再显示未收录提示", () => {
    window.history.replaceState(
      null,
      "",
      "/?scope=custom&region=region-americas"
    );
    renderApp();

    const timeline = screen.getByRole("region", { name: "多地区完整时间轴" });
    expect(within(timeline).getByRole("button", { name: /^阿兹特克帝国，/ })).toBeInTheDocument();
    expect(within(timeline).getByRole("button", { name: /^印加帝国，/ })).toBeInTheDocument();
    expect(timeline).not.toHaveTextContent("尚未收录代表性政权");
  });

  it("时间点模式隐藏重复图例并在全览模式恢复", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=978");
    const user = userEvent.setup();
    renderApp();

    expect(screen.queryByLabelText("类别图例")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "全览" }));
    expect(screen.getByLabelText("类别图例")).toBeInTheDocument();
  });

  it("从时间点 URL 恢复并把历史分期与政权分开呈现", () => {
    window.history.replaceState(null, "", "/?mode=point&year=-770");
    renderApp();

    const polities = screen.getByRole("region", { name: "当时存在的政权" });
    const context = screen.getByRole("region", { name: "历史背景" });
    expect(within(polities).getByRole("button", { name: /^东周，/ })).toBeInTheDocument();
    expect(within(polities).queryByRole("button", { name: /春秋/ })).not.toBeInTheDocument();
    expect(within(context).getByRole("button", { name: /春秋/ })).toBeInTheDocument();
    expect(screen.getByText(/年代口径存在争议/)).toBeInTheDocument();
    expect(screen.getByText(/起止边界/)).toBeInTheDocument();
  });

  it("将当前年份置于滑杆上方，并把年份加减放在滑杆首尾", () => {
    window.history.replaceState(null, "", "/?mode=point&year=-221");
    renderApp();

    const currentYear = screen.getByLabelText("当前年份");
    const slider = screen.getByRole("slider", { name: "历史年份滑杆" });
    const sliderRow = slider.closest(".year-slider-row");

    expect(currentYear).toHaveTextContent("前221");
    expect(currentYear.closest(".year-current")?.nextElementSibling).toBe(sliderRow);
    expect(sliderRow?.firstElementChild).toHaveAccessibleName("上一年");
    expect(sliderRow?.lastElementChild).toHaveAccessibleName("下一年");
    expect(screen.queryByRole("textbox", { name: "当前年份" })).not.toBeInTheDocument();
  });

  it("用键盘操作年份首尾按钮并在公元前后步进时跳过零年", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=-1");
    const user = userEvent.setup();
    renderApp();
    const currentYear = screen.getByLabelText("当前年份");

    const nextYear = screen.getByRole("button", { name: "下一年" });
    nextYear.focus();
    await user.keyboard("{Enter}");
    expect(currentYear).toHaveTextContent("1");
    expect(new URLSearchParams(window.location.search).get("year")).toBe("1");

    const previousYear = screen.getByRole("button", { name: "上一年" });
    previousYear.focus();
    await user.keyboard("{Enter}");
    expect(currentYear).toHaveTextContent("前1");
  });

  it("通过滑杆序数跨越公元前后且不产生公元零年", () => {
    window.history.replaceState(null, "", "/?mode=point&year=-1");
    renderApp();
    const slider = screen.getByRole("slider", { name: "历史年份滑杆" });

    fireEvent.change(slider, { target: { value: "1" } });
    expect(screen.getByLabelText("当前年份")).toHaveTextContent("1");
    fireEvent.change(slider, { target: { value: "0" } });
    expect(screen.getByLabelText("当前年份")).toHaveTextContent("前1");
  });

  it("在约年边界给出解释，并为组合筛选提供明确空状态", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=-2070");
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByText(/起止年份采用约略年代/)).toBeInTheDocument();
    expect(screen.getByText("年代约略")).toBeInTheDocument();
    expect(screen.queryByText("约年")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "不存在的政权");
    expect(screen.getByRole("region", { name: "当时存在的政权" })).toHaveTextContent(
      "没有匹配当前搜索与类别的政权"
    );
  });

  it("在时间点详情展示单一在位统治者、完整任期和来源", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400");
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /^明，/ }));

    const dialog = screen.getByRole("dialog", { name: "明" });
    expect(within(dialog).getByRole("heading", { name: "1400年 · 在位统治者" }))
      .toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "建文帝" })).toBeInTheDocument();
    expect(within(dialog).getByText("1398—1402")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /中国历代帝王年表/ }))
      .toHaveAttribute("target", "_blank");
  });

  it("同年展示皇帝与两位摄政者且不误标争议", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1862");
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /^夏，/ }));

    const dialog = screen.getByRole("dialog", { name: "夏" });
    expect(within(dialog).getByText("存在争议")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "夏禹" })).toBeInTheDocument();
    expect(within(dialog).getByText(/完整任期无法可靠核定/)).toBeInTheDocument();
  });

  it("区分明确空位和资料尚未校订", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?mode=point&year=-840");
    const firstRender = renderApp();

    await user.click(screen.getByRole("button", { name: /^西周，/ }));
    expect(within(screen.getByRole("dialog", { name: "西周" })).getByText("已有资料记为空位期"))
      .toBeInTheDocument();

    firstRender.unmount();
    window.history.replaceState(null, "", "/?mode=point&year=312");
    renderApp();
    await user.click(screen.getByRole("button", { name: /^西晋，/ }));

    const dialog = screen.getByRole("dialog", { name: "西晋" });
    expect(within(dialog).getByText("这一年的统治者资料尚未校订")).toBeInTheDocument();
    expect(within(dialog).getByText(/不等于当时无人统治/)).toBeInTheDocument();
  });

  it("全览详情不使用隐藏年份且历史分期不显示统治者区域", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /明，1368—1644/ }));
    const mingDialog = screen.getByRole("dialog", { name: "明" });
    expect(within(mingDialog).getByText(/切换到时间点模式/)).toBeInTheDocument();
    expect(within(mingDialog).queryByText(/1912年 · 在位统治者/)).not.toBeInTheDocument();
    await user.click(within(mingDialog).getByRole("button", { name: "关闭详情" }));

    await user.click(screen.getByRole("button", { name: /春秋.*历史分期/ }));
    expect(within(screen.getByRole("dialog", { name: "春秋" })).queryByText(/在位统治者/))
      .not.toBeInTheDocument();
  });

  it("打开详情时立即显示基础信息并在数据到达后展示统治者", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400");
    const deferred = createDeferred<CrownlineDetail | null>();
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    renderApp(async () => null);

    await user.click(screen.getByRole("button", { name: /春秋.*历史分期/ }));

    expect(
      await within(screen.getByRole("dialog", { name: "春秋" })).findByText("暂无已整理详情")
    ).toBeInTheDocument();
  });

  it("关闭详情后忽略迟到的旧请求结果", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=1400");
    const deferred = createDeferred<CrownlineDetail | null>();
    const user = userEvent.setup();
    renderApp(() => deferred.promise);

    await user.click(screen.getByRole("button", { name: /^明，/ }));
    await user.click(within(screen.getByRole("dialog", { name: "明" })).getByRole("button", {
      name: "关闭详情"
    }));
    deferred.resolve(artifacts.details.get("polity-cn-ming") ?? null);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "明" })).not.toBeInTheDocument());
  });
});
