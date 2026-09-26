import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TimeRangeControl } from "../src/components/TimeRangeControl";
import type { TimeRange } from "../src/domain/browseState";
import { installAppTestLifecycle, renderApp } from "./helpers/renderApp";
import { setupUser } from "./helpers/user";

installAppTestLifecycle();

const yearBounds = { min: -2070, max: 1922 };

function renderYearControl({
  year = 800,
  value = "year" as TimeRange,
  onYearChange = vi.fn(),
  onChange = vi.fn()
} = {}) {
  const view = render(
    <TimeRangeControl
      value={value}
      year={year}
      yearBounds={yearBounds}
      onChange={onChange}
      onYearChange={onYearChange}
    />
  );
  return { ...view, onChange, onYearChange };
}

describe("精确历史年份输入", () => {
  it("使用纪元与正整数跳转，并支持 Enter 提交", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    renderYearControl({ onYearChange });

    const input = screen.getByRole("textbox", { name: "年份" });
    expect(input).toHaveAttribute("inputmode", "numeric");

    await user.selectOptions(screen.getByRole("combobox", { name: "纪元" }), "bce");
    await user.clear(input);
    await user.type(input, "221{Enter}");

    expect(onYearChange).toHaveBeenCalledWith(-221);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    { input: "", error: "请输入年份。" },
    { input: "1.5", error: "年份必须是大于 0 的整数。" },
    { input: "abc", error: "年份必须是大于 0 的整数。" }
  ])("拒绝无效输入：$input", async ({ input, error }) => {
    const user = setupUser();
    const onYearChange = vi.fn();
    renderYearControl({ onYearChange });

    const yearInput = screen.getByRole("textbox", { name: "年份" });
    await user.clear(yearInput);
    await user.type(yearInput, `${input}{Enter}`);

    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(yearInput).toHaveAttribute("aria-invalid", "true");
    expect(onYearChange).not.toHaveBeenCalled();
  });

  it("分别解释零年与超出数据范围的年份", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    renderYearControl({ onYearChange });
    const input = screen.getByRole("textbox", { name: "年份" });

    await user.clear(input);
    await user.type(input, "0");
    await user.click(screen.getByRole("button", { name: "跳转" }));
    expect(screen.getByRole("alert")).toHaveTextContent("历史纪年不存在公元 0 年。");

    await user.clear(input);
    await user.type(input, "1923");
    await user.click(screen.getByRole("button", { name: "跳转" }));
    expect(screen.getByRole("alert")).toHaveTextContent("可跳转范围为前2070至1922。");

    // 改纪元会立即提交，超出范围同样给出提示而不跳转。
    await user.clear(input);
    await user.type(input, "2071");
    await user.selectOptions(screen.getByRole("combobox", { name: "纪元" }), "bce");
    expect(screen.getByRole("alert")).toHaveTextContent("可跳转范围为前2070至1922。");
    expect(onYearChange).not.toHaveBeenCalled();
  });

  it("外部年份变化会刷新纪元和输入值并清除旧错误", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    const { rerender } = renderYearControl({ year: -221, onYearChange });
    const input = screen.getByRole("textbox", { name: "年份" });

    await user.clear(input);
    await user.type(input, "{Enter}");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <TimeRangeControl
        value="year"
        year={618}
        yearBounds={yearBounds}
        onChange={vi.fn()}
        onYearChange={onYearChange}
      />
    );

    expect(screen.getByRole("combobox", { name: "纪元" })).toHaveValue("ce");
    expect(input).toHaveValue("618");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("修改后离开输入框即提交；清空后离开则恢复当前年份", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    renderYearControl({ onYearChange });
    const input = screen.getByRole("textbox", { name: "年份" });

    await user.clear(input);
    await user.type(input, "1200");
    expect(screen.getByRole("button", { name: "跳转" })).toBeInTheDocument();
    await user.tab();
    expect(onYearChange).toHaveBeenCalledWith(1200);

    onYearChange.mockClear();
    // 父组件未更新年份时，当前值仍是 800。
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue("800");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onYearChange).not.toHaveBeenCalled();
  });

  it("未修改时不显示跳转按钮，离开输入框不会重复提交", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    renderYearControl({ onYearChange });

    expect(screen.queryByRole("button", { name: "跳转" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("textbox", { name: "年份" }));
    await user.tab();
    expect(onYearChange).not.toHaveBeenCalled();
  });

  it("改纪元立即以同一数字跳转", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    renderYearControl({ year: 221, onYearChange });

    await user.selectOptions(screen.getByRole("combobox", { name: "纪元" }), "bce");
    expect(onYearChange).toHaveBeenCalledWith(-221);
  });

  it("全时期时年份框留空、步进禁用，输入年份后进入该年", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    const onChange = vi.fn();
    renderYearControl({ value: "all", year: 1922, onYearChange, onChange });

    const input = screen.getByRole("textbox", { name: "年份" });
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "输入年份");
    expect(screen.getByRole("button", { name: "全时期" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "上一年" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一年" })).toBeDisabled();

    await user.selectOptions(screen.getByRole("combobox", { name: "纪元" }), "bce");
    expect(onYearChange).not.toHaveBeenCalled();

    await user.type(input, "770{Enter}");
    expect(onYearChange).toHaveBeenCalledWith(-770);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("指定年份时“全时期”按钮退出年份", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderYearControl({ onChange });

    const allTime = screen.getByRole("button", { name: "全时期" });
    expect(allTime).toHaveAttribute("aria-pressed", "false");
    await user.click(allTime);
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("外部连续改年份（拖动滑杆）时不会闪现跳转按钮", () => {
    function Harness() {
      const [year, setYear] = useState(800);
      return (
        <TimeRangeControl
          value="year"
          year={year}
          yearBounds={yearBounds}
          onChange={vi.fn()}
          onYearChange={setYear}
        />
      );
    }
    render(<Harness />);
    const slider = screen.getByRole("slider", { name: "历史年份滑杆" });
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, subtree: true });

    for (const ordinal of [500, 600, 700]) {
      fireEvent.change(slider, { target: { value: String(ordinal) } });
    }

    // 过渡渲染也会写入 DOM，逐条检查新增节点，而不只看最终状态。
    const flashed = observer
      .takeRecords()
      .flatMap((record) => [...record.addedNodes])
      .some((node) => node instanceof HTMLElement && node.textContent === "跳转");
    observer.disconnect();
    expect(flashed).toBe(false);
    expect(screen.getByRole("textbox", { name: "年份" })).toHaveValue("700");
  });

  it("把跳转结果写入 URL，并在 popstate 后同步外部年份", async () => {
    window.history.replaceState(null, "", "/?mode=point&year=-221&external=kept");
    const user = setupUser();
    renderApp();

    const era = screen.getByRole("combobox", { name: "纪元" });
    const input = screen.getByRole("textbox", { name: "年份" });
    expect(era).toHaveValue("bce");
    expect(input).toHaveValue("221");

    await user.selectOptions(era, "ce");
    await user.clear(input);
    await user.type(input, "618{Enter}");

    let params = new URLSearchParams(window.location.search);
    expect(params.get("mode")).toBe("point");
    expect(params.get("year")).toBe("618");
    expect(params.get("external")).toBe("kept");

    act(() => {
      window.history.replaceState(null, "", "/?mode=point&year=-770&external=kept");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(input).toHaveValue("770"));
    expect(era).toHaveValue("bce");
    params = new URLSearchParams(window.location.search);
    expect(params.get("year")).toBe("-770");
    expect(params.get("external")).toBe("kept");
  });
});
