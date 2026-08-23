import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { setupUser } from "./helpers/user";

import { loadSourceData } from "../scripts/data-source";
import { HistoricalMap } from "../src/components/HistoricalMap";
import { MapLoadPanel } from "../src/components/MapLoadPanel";
import { MapResultList } from "../src/components/MapResultList";
import {
  clusterMapPoints,
  projectCoordinates,
  selectMapSnapshots,
  type MapPoint
} from "../src/domain/mapSnapshots";

const data = await loadSourceData();

function entity(id: string) {
  const result = data.entities.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`缺少测试实体 ${id}`);
  return result;
}

function snapshot(id: string) {
  const result = data.geographicSnapshots.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`缺少测试地理快照 ${id}`);
  return result;
}

function point(entityId: string, snapshotId: string): MapPoint {
  const mapSnapshot = snapshot(snapshotId);
  return {
    entity: entity(entityId),
    snapshot: mapSnapshot,
    ...projectCoordinates(mapSnapshot.coordinates)
  };
}

describe("历史地图组件", () => {
  it("呈现本地底图和可选择的单点标记", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const selection = selectMapSnapshots(
      [entity("polity-cn-northern-wei")],
      data.geographicSnapshots,
      500
    );

    render(<HistoricalMap clusters={selection.clusters} onSelect={onSelect} />);

    const map = screen.getByRole("region", { name: "当前年份历史政权示意地图" });
    const marker = within(map).getByRole("button", { name: "北魏，洛阳，都城" });
    expect(within(map).getByRole("presentation")).toBeInTheDocument();
    const legend = within(map).getByRole("list", { name: "地图点位图例" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(4);
    expect(legend).toHaveTextContent("都城");
    expect(legend).toHaveTextContent("政治中心");
    expect(legend).toHaveTextContent("代表性中心");
    expect(legend).toHaveTextContent("数字表示邻近点位聚合");
    await user.click(marker);
    expect(onSelect).toHaveBeenCalledWith("polity-cn-northern-wei", marker);
  });

  it("展开稳定聚合后提供每个历史点位的详情入口", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const beijing = point("polity-cn-ming", "geo-ming-beijing");
    const nanjing = point("polity-cn-ming", "geo-ming-nanjing");
    const clusters = clusterMapPoints([nanjing, beijing], 5);

    render(<HistoricalMap clusters={clusters} onSelect={onSelect} />);

    const cluster = screen.getByRole("button", { name: "此处有 2 个历史点位" });
    expect(cluster).toHaveAttribute("aria-expanded", "false");
    await user.click(cluster);
    expect(cluster).toHaveAttribute("aria-expanded", "true");

    const expanded = screen.getByRole("region", { name: "聚合历史点位" });
    expect(expanded).toHaveTextContent("此处有 2 个历史点位");
    await user.click(within(expanded).getByRole("button", { name: "关闭聚合点位" }));
    expect(cluster).toHaveAttribute("aria-expanded", "false");
    expect(cluster).toHaveFocus();

    await user.click(cluster);
    const reopenedPanel = screen.getByRole("region", { name: "聚合历史点位" });
    const beijingButton = within(reopenedPanel).getByRole("button", {
      name: "明，北京，都城"
    });
    expect(beijingButton).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(cluster).toHaveAttribute("aria-expanded", "false");
    expect(cluster).toHaveFocus();

    await user.click(cluster);
    const reopenedBeijingButton = within(
      screen.getByRole("region", {
        name: "聚合历史点位"
      })
    ).getByRole("button", { name: "明，北京，都城" });
    await user.click(reopenedBeijingButton);
    expect(onSelect).toHaveBeenCalledWith("polity-cn-ming", reopenedBeijingButton);
  });

  it("结果列表提供等价详情入口并单列缺少地理数据的政权", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const northernWei = point("polity-cn-northern-wei", "geo-northern-wei-luoyang");
    const sui = entity("polity-cn-sui");

    render(
      <MapResultList
        points={[northernWei]}
        missingEntities={[sui]}
        comparisonEntityIds={[]}
        onSelect={onSelect}
        onToggleComparison={vi.fn()}
      />
    );

    const list = screen.getByRole("region", { name: "地图结果列表" });
    expect(list).toHaveTextContent("尚未校订地理数据");
    expect(list).toHaveTextContent("隋");
    const item = within(list).getByRole("button", { name: "北魏，洛阳，都城" });
    expect(within(item).getByText("洛阳")).toHaveClass("map-result-place");
    await user.click(item);
    expect(onSelect).toHaveBeenCalledWith("polity-cn-northern-wei", item);
  });

  it("复用对比按钮标签并禁用第三个未选政权", async () => {
    const user = setupUser();
    const onToggleComparison = vi.fn();
    render(
      <MapResultList
        points={[
          point("polity-cn-tang", "geo-tang-changan"),
          point("polity-cn-ming", "geo-ming-beijing"),
          point("polity-cn-qing", "geo-qing-beijing")
        ]}
        missingEntities={[]}
        comparisonEntityIds={["polity-cn-tang", "polity-cn-ming"]}
        onSelect={vi.fn()}
        onToggleComparison={onToggleComparison}
      />
    );

    const removeTang = screen.getByRole("button", { name: "将唐移出对比" });
    expect(removeTang).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "将清加入对比" })).toBeDisabled();
    await user.click(removeTang);
    expect(onToggleComparison).toHaveBeenCalledWith("polity-cn-tang");
  });

  it("呈现加载状态和可重试的错误提示", async () => {
    const user = setupUser();
    const onRetry = vi.fn();
    const view = render(<MapLoadPanel state="loading" onRetry={onRetry} />);

    expect(screen.getByRole("status")).toHaveTextContent("正在加载地理数据");
    view.rerender(
      <MapLoadPanel state={{ error: "无法加载地理数据（HTTP 503）" }} onRetry={onRetry} />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("无法加载地理数据（HTTP 503）");
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
