import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setupUser } from "../helpers/user";
import { installAppTestLifecycle, renderApp } from "../helpers/renderApp";
installAppTestLifecycle();

const searchParams = () => new URLSearchParams(window.location.search);

describe("全览时间窗口", () => {
  it("点击刻度分段放大，写入 URL 并只保留窗口内的条目", async () => {
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "放大到 500—1000" }));

    expect(searchParams().get("from")).toBe("500");
    expect(searchParams().get("to")).toBe("1000");
    expect(
      screen.getByRole("group", { name: "时段刻度：500—1000，每100年一格" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("500—1000");
    expect(screen.getByRole("button", { name: "查看唐详情" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看夏详情" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看清详情" })).not.toBeInTheDocument();
  });

  it("窗口外的存续区间不绘制时间条", () => {
    window.history.replaceState(null, "", "/?from=600&to=700");
    renderApp();

    expect(screen.getAllByRole("button", { name: /^唐，/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^唐，618—690，/ })).toBeInTheDocument();
  });

  it("缩小时段并可返回全时期", async () => {
    window.history.replaceState(null, "", "/?from=500&to=1000");
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "缩小时段" }));
    expect(searchParams().get("from")).toBe("-200");
    expect(searchParams().get("to")).toBe("1600");

    await user.click(screen.getByRole("button", { name: "返回全时期" }));
    expect(searchParams().has("from")).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("显示 137 / 137 个条目");
    expect(
      screen.getByRole("group", { name: "统一时间刻度：前2070—1922，每500年一格" })
    ).toBeInTheDocument();
  });

  it("活跃筛选标签可移除时段，清除搜索与类别不影响窗口", async () => {
    window.history.replaceState(null, "", "/?from=500&to=1000&q=%E5%94%90");
    const user = setupUser();
    renderApp();

    const filters = screen.getAllByLabelText("活跃筛选")[0]!;
    await user.click(within(filters).getByRole("button", { name: "清除搜索与类别" }));
    expect(searchParams().get("from")).toBe("500");

    await user.click(
      within(screen.getAllByLabelText("活跃筛选")[0]!).getByRole("button", {
        name: "移除时段：500—1000"
      })
    );
    expect(searchParams().has("from")).toBe(false);
  });

  it("窗口内没有已收录政权时不把未收录写成历史上不存在", async () => {
    window.history.replaceState(
      null,
      "",
      "/?scope=custom&region=region-east-africa&from=1800&to=1900"
    );
    const user = setupUser();
    renderApp();

    const timeline = screen.getByRole("region", { name: "多地区完整时间轴" });
    expect(timeline).toHaveTextContent("时段 1800—1900 内暂无已收录条目");
    expect(timeline).toHaveTextContent("这不表示该时期没有政权");

    await user.click(within(timeline).getByRole("button", { name: "返回全时期" }));
    expect(searchParams().has("from")).toBe(false);
  });

  it("中国范围放大后改用统一窗口刻度，不再绘制各阶段坐标轴", () => {
    window.history.replaceState(null, "", "/?scope=china&from=600&to=700");
    renderApp();

    expect(screen.getAllByRole("group", { name: /^时段刻度：600—700/ })).toHaveLength(1);
    expect(screen.queryAllByRole("group", { name: /^阶段时间刻度/ })).toHaveLength(0);
  });

  it("时间窗口只作用于全时期时间轴，切到指定年份时不写入 URL 并在返回后恢复", async () => {
    window.history.replaceState(null, "", "/?from=500&to=1000");
    const user = setupUser();
    renderApp();

    await user.click(screen.getByRole("button", { name: "指定年份" }));
    expect(searchParams().has("from")).toBe(false);

    await user.click(screen.getByRole("button", { name: "全时期" }));
    expect(searchParams().get("from")).toBe("500");
  });
});
