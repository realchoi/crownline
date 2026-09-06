import { act, render, screen, waitFor } from "@testing-library/react";
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
  onYearChange = vi.fn()
} = {}) {
  const onChange = vi.fn();
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
    if (input) await user.type(yearInput, input);
    await user.click(screen.getByRole("button", { name: "跳转" }));

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

    await user.selectOptions(screen.getByRole("combobox", { name: "纪元" }), "bce");
    await user.clear(input);
    await user.type(input, "2071");
    await user.click(screen.getByRole("button", { name: "跳转" }));
    expect(screen.getByRole("alert")).toHaveTextContent("可跳转范围为前2070至1922。");
    expect(onYearChange).not.toHaveBeenCalled();
  });

  it("外部年份变化会刷新纪元和输入值并清除旧错误", async () => {
    const user = setupUser();
    const onYearChange = vi.fn();
    const { rerender } = renderYearControl({ year: -221, onYearChange });
    const input = screen.getByRole("textbox", { name: "年份" });

    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "跳转" }));
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
