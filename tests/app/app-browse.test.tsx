import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setupUser } from "../helpers/user";
import { installAppTestLifecycle, renderApp } from "../helpers/renderApp";
installAppTestLifecycle();

describe("Crownline 浏览", () => {
  it("初始展示全球已收录的全部实体", () => {
    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("显示 116 / 116 个条目");
    expect(screen.getByRole("heading", { name: "Crownline · 王冠纪" })).toBeInTheDocument();
    expect(screen.getByLabelText("地区范围")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全球已收录" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("region", { name: "多地区完整时间轴" })).toBeInTheDocument();
  });

  it("按名称或别名搜索并支持空结果", async () => {
    const user = setupUser();
    renderApp();
    const search = screen.getByRole("searchbox", { name: "搜索名称、别名、年份或说明" });

    await user.type(search, "殷商");
    expect(screen.getByRole("status")).toHaveTextContent("显示 1 / 116 个条目");

    await user.clear(search);
    await user.type(search, "不存在的政权");
    expect(screen.getByRole("region", { name: "多地区完整时间轴" })).toHaveTextContent(
      "没有找到匹配条目。"
    );
  });

  it("按展示类别筛选并清除筛选", async () => {
    const user = setupUser();
    renderApp();
    const select = screen.getByRole("combobox", { name: "显示类别" });

    await user.selectOptions(select, "context");
    expect(screen.getByRole("status")).toHaveTextContent("显示 2 / 116 个条目");

    await user.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("status")).toHaveTextContent("显示 116 / 116 个条目");
    expect(select).toHaveValue("all");
  });

  it("从 URL 恢复并同步搜索与类别状态", async () => {
    window.history.replaceState(null, "", "/?q=时期&type=context");
    const user = setupUser();
    renderApp();

    expect(screen.getByRole("searchbox")).toHaveValue("时期");
    expect(screen.getByRole("combobox")).toHaveValue("context");
    expect(screen.getByRole("status")).toHaveTextContent("显示 2 / 116 个条目");

    await user.selectOptions(screen.getByRole("combobox"), "all");
    expect(new URLSearchParams(window.location.search).has("type")).toBe(false);
  });

  it("在全览和时间点模式间切换并同步 URL", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "时间点" }));

    expect(screen.getByRole("region", { name: "1922 年时间点结果" })).toHaveTextContent(
      "1922年 · 当时存在"
    );
    expect(screen.getByLabelText("当前年份")).toHaveTextContent("1922");
    expect(new URLSearchParams(window.location.search).get("mode")).toBe("point");

    await user.click(screen.getByRole("button", { name: "全览" }));
    expect(screen.getByRole("region", { name: "多地区完整时间轴" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("mode")).toBe(false);
  });

  it("切换地图时保留年份控件并在返回时间轴后恢复原浏览模式", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "时间点" }));
    await user.click(screen.getByRole("button", { name: "地图" }));

    expect(screen.getByLabelText("当前年份")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "时间点" })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("view")).toBe("map");

    await user.click(screen.getByRole("button", { name: "时间轴" }));

    expect(screen.getByRole("button", { name: "时间点" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "1922 年时间点结果" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("view")).toBe(false);
  });

  it("默认全球范围不写 URL，切换中国后显式写入并可恢复全球", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "时间点" }));
    expect(new URLSearchParams(window.location.search).has("scope")).toBe(false);

    await user.click(screen.getByRole("button", { name: "中国" }));
    expect(new URLSearchParams(window.location.search).get("scope")).toBe("china");

    await user.click(screen.getByRole("button", { name: "全球已收录" }));

    expect(new URLSearchParams(window.location.search).has("scope")).toBe(false);
    expect(screen.getByLabelText("地区范围")).toHaveTextContent("当前数据集中的全部已收录条目");
  });

  it("从 URL 恢复自选地区并把覆盖有限与历史不存在区分开", () => {
    window.history.replaceState(
      null,
      "",
      "/?mode=point&year=1000&scope=custom&region=region-east-africa"
    );
    renderApp();

    expect(screen.getByRole("button", { name: "自选地区" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("checkbox", { name: "东非" })).toBeChecked();
    expect(screen.getByRole("region", { name: "当时存在的政权" })).toHaveTextContent(
      "当前数据覆盖有限，不表示当时不存在政权"
    );
  });

  it("在全览与时间点之间切换时保持全球范围", async () => {
    window.history.replaceState(null, "", "/?mode=point&scope=global");
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "全览" }));

    expect(new URLSearchParams(window.location.search).has("scope")).toBe(false);
    expect(screen.getByRole("button", { name: "全球已收录" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("region", { name: "多地区完整时间轴" })).toBeInTheDocument();
  });

  it("从 URL 恢复全球全览并去重展示跨地区实体", () => {
    window.history.replaceState(null, "", "/?scope=global");
    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("显示 116 / 116 个条目");
    expect(screen.getByRole("heading", { name: "跨地区政权" })).toBeInTheDocument();
    expect(screen.getAllByText("拜占庭帝国")).toHaveLength(1);
    expect(screen.getAllByText("阿拔斯哈里发")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^神圣罗马帝国，/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^朱罗帝国，/ })).toBeInTheDocument();
  });

  it("自选地区展示新增全球样本地区复选框", async () => {
    const user = setupUser();
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

    expect(screen.getAllByRole("img", { name: "统一时间刻度：前322—1922，中点801" })).toHaveLength(
      1
    );

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
    const user = setupUser();
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
    window.history.replaceState(null, "", "/?scope=custom&region=region-americas");
    renderApp();

    const timeline = screen.getByRole("region", { name: "多地区完整时间轴" });
    expect(within(timeline).getByRole("button", { name: /^阿兹特克帝国，/ })).toBeInTheDocument();
    expect(within(timeline).getByRole("button", { name: /^印加帝国，/ })).toBeInTheDocument();
    expect(timeline).not.toHaveTextContent("尚未收录代表性政权");
  });

  it("时间点模式隐藏重复图例并在全览模式恢复", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=978");
    const user = setupUser();
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
    const user = setupUser();
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
    const user = setupUser();
    renderApp();

    expect(screen.getByText(/起止年份采用约略年代/)).toBeInTheDocument();
    expect(screen.getByText("年代约略")).toBeInTheDocument();
    expect(screen.queryByText("约年")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "不存在的政权");
    expect(screen.getByRole("region", { name: "当时存在的政权" })).toHaveTextContent(
      "没有匹配当前搜索与类别的政权"
    );
  });
});
