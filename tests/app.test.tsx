import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/app/App";
import { loadCrownlineData } from "../src/data/loadCrownlineData";
import "../src/styles/styles.css";

const data = loadCrownlineData();
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
    render(<App data={data} />);

    expect(screen.getByText("显示 73 / 73 个条目，涉及 7 个历史阶段")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crownline · 王冠纪" })).toBeInTheDocument();
  });

  it("按名称或别名搜索并支持空结果", async () => {
    const user = userEvent.setup();
    render(<App data={data} />);
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
    render(<App data={data} />);
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
    render(<App data={data} />);

    expect(screen.getByRole("searchbox")).toHaveValue("时期");
    expect(screen.getByRole("combobox")).toHaveValue("context");
    expect(screen.getByText("显示 2 / 73 个条目，涉及 1 个历史阶段")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "all");
    expect(new URLSearchParams(window.location.search).has("type")).toBe(false);
  });

  it("为中断政权绘制多个时间条，并在详情计算实际总时长", async () => {
    const user = userEvent.setup();
    render(<App data={data} />);
    const westernQinBars = screen.getAllByRole("button", { name: /西秦/ });

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
    render(<App data={data} />);

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

    render(<App data={data} />);
    await user.click(screen.getAllByRole("button", { name: /西秦/ })[0]!);

    expect(showModal).toHaveBeenCalledOnce();
  });

  it("在全览和时间点模式间切换并同步 URL", async () => {
    const user = userEvent.setup();
    render(<App data={data} />);

    await user.click(screen.getByRole("button", { name: "时间点" }));

    expect(screen.getByRole("region", { name: "1912 年时间点结果" })).toHaveTextContent(
      "1912年 · 当时存在"
    );
    expect(screen.getByRole("textbox", { name: "当前年份" })).toHaveValue("1912");
    expect(screen.getByRole("status")).toHaveTextContent("显示 1 个政权，另有 0 条历史背景");
    expect(new URLSearchParams(window.location.search).get("mode")).toBe("point");

    await user.click(screen.getByRole("button", { name: "全览" }));
    expect(screen.getByRole("region", { name: "中国历代王朝时间轴" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("mode")).toBe(false);
  });

  it("时间点模式隐藏重复图例并在全览模式恢复", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=978");
    const user = userEvent.setup();
    render(<App data={data} />);

    expect(screen.queryByLabelText("类别图例")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "全览" }));
    expect(screen.getByLabelText("类别图例")).toBeInTheDocument();
  });

  it("从时间点 URL 恢复并把历史分期与政权分开呈现", () => {
    window.history.replaceState(null, "", "/?mode=point&year=-770");
    render(<App data={data} />);

    const polities = screen.getByRole("region", { name: "当时存在的政权" });
    const context = screen.getByRole("region", { name: "历史背景" });
    expect(within(polities).getByRole("button", { name: /东周/ })).toBeInTheDocument();
    expect(within(polities).queryByRole("button", { name: /春秋/ })).not.toBeInTheDocument();
    expect(within(context).getByRole("button", { name: /春秋/ })).toBeInTheDocument();
    expect(screen.getByText(/年代口径存在争议/)).toBeInTheDocument();
    expect(screen.getByText(/起止边界/)).toBeInTheDocument();
  });

  it("用键盘提交传统年份输入并在公元前后步进时跳过零年", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=-1");
    const user = userEvent.setup();
    render(<App data={data} />);
    const yearInput = screen.getByRole("textbox", { name: "当前年份" });

    const nextYear = screen.getByRole("button", { name: "下一年" });
    nextYear.focus();
    await user.keyboard("{Enter}");
    expect(yearInput).toHaveValue("1");
    expect(new URLSearchParams(window.location.search).get("year")).toBe("1");

    await user.clear(yearInput);
    await user.type(yearInput, "前221{Enter}");
    expect(yearInput).toHaveValue("前221");
    expect(screen.getByRole("region", { name: "前221 年时间点结果" })).toBeInTheDocument();
  });

  it("拒绝无效或超出数据范围的年份并保留当前结果", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=-221");
    const user = userEvent.setup();
    render(<App data={data} />);
    const yearInput = screen.getByRole("textbox", { name: "当前年份" });

    await user.clear(yearInput);
    await user.type(yearInput, "0{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("不存在公元 0 年");
    expect(screen.getByRole("region", { name: "前221 年时间点结果" })).toBeInTheDocument();

    await user.clear(yearInput);
    await user.type(yearInput, "3000{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("可浏览范围为前2070—1912");
  });

  it("通过滑杆序数跨越公元前后且不产生公元零年", () => {
    window.history.replaceState(null, "", "/?mode=point&year=-1");
    render(<App data={data} />);
    const slider = screen.getByRole("slider", { name: "历史年份滑杆" });

    fireEvent.change(slider, { target: { value: "1" } });
    expect(screen.getByRole("textbox", { name: "当前年份" })).toHaveValue("1");
    fireEvent.change(slider, { target: { value: "0" } });
    expect(screen.getByRole("textbox", { name: "当前年份" })).toHaveValue("前1");
  });

  it("在约年边界给出解释，并为组合筛选提供明确空状态", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=-2070");
    const user = userEvent.setup();
    render(<App data={data} />);

    expect(screen.getByText(/起止年代为约年/)).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "不存在的政权");
    expect(screen.getByRole("region", { name: "当时存在的政权" })).toHaveTextContent(
      "没有匹配当前搜索与类别的政权"
    );
  });
});
