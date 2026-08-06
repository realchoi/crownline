import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../src/app/App";
import { loadCrownlineData } from "../src/data/loadCrownlineData";

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
});
