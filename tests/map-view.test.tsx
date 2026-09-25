import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { setupUser } from "./helpers/user";

import { loadSourceData } from "../scripts/data-source";
import { HistoricalMap } from "../src/components/HistoricalMap";
import { MapLoadPanel } from "../src/components/MapLoadPanel";
import { MapResultList } from "../src/components/MapResultList";
import { projectCoordinates, selectMapSnapshots, type MapPoint } from "../src/domain/mapSnapshots";
import {
  GLOBAL_MAP_VIEWPORT,
  GLOBAL_MAP_VIEW_STATE,
  MAP_VIEWPORT_PRESETS,
  viewportFromBounds
} from "../src/domain/mapViewport";

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

/** 取景状态由外层持有；独立渲染地图时用本地 state 模拟 MapBrowseView。 */
function StatefulMap(props: Omit<ComponentProps<typeof HistoricalMap>, "view" | "onViewChange">) {
  const [view, setView] = useState(GLOBAL_MAP_VIEW_STATE);
  return <HistoricalMap {...props} view={view} onViewChange={setView} />;
}

const EAST_ASIA_VIEWPORT = viewportFromBounds(
  MAP_VIEWPORT_PRESETS.find(({ id }) => id === "east-asia")!.bounds
);

describe("历史地图组件", () => {
  it("呈现本地底图和可选择的单点标记", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const selection = selectMapSnapshots(
      [entity("polity-cn-northern-wei")],
      data.geographicSnapshots,
      500
    );

    render(<StatefulMap points={selection.points} onSelect={onSelect} />);

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
    expect(onSelect).toHaveBeenCalledWith("polity-cn-northern-wei");
  });

  it("展开稳定聚合后提供每个历史点位的详情入口", async () => {
    const user = setupUser();
    const onSelect = vi.fn();
    const beijing = point("polity-cn-ming", "geo-ming-beijing");
    const nanjing = point("polity-cn-ming", "geo-ming-nanjing");

    render(
      <StatefulMap points={[nanjing, beijing]} clusterThresholdPercent={5} onSelect={onSelect} />
    );

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
    expect(onSelect).toHaveBeenCalledWith("polity-cn-ming");
  });

  it("切换大区视野时只渲染视野内标记并提示视野外数量", async () => {
    const user = setupUser();
    const beijing = point("polity-cn-ming", "geo-ming-beijing");
    const luoyang = point("polity-cn-northern-wei", "geo-northern-wei-luoyang");
    const tenochtitlan = selectMapSnapshots(
      [entity("polity-aztec-empire")],
      data.geographicSnapshots
    ).points;
    expect(tenochtitlan.length).toBeGreaterThan(0);

    render(<StatefulMap points={[beijing, luoyang, ...tenochtitlan]} onSelect={vi.fn()} />);
    const map = screen.getByRole("region", { name: "当前年份历史政权示意地图" });
    const status = within(map).getByRole("status");
    expect(status).toHaveTextContent(`视野内 ${2 + tenochtitlan.length} 个点位。`);

    const eastAsia = within(map).getByRole("button", { name: "东亚" });
    await user.click(eastAsia);
    expect(eastAsia).toHaveAttribute("aria-pressed", "true");
    expect(within(map).getByRole("button", { name: "全球" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(within(map).getByRole("button", { name: "明，北京，都城" })).toBeInTheDocument();
    expect(within(map).queryByRole("button", { name: /阿兹特克帝国/ })).not.toBeInTheDocument();
    expect(status).toHaveTextContent(
      `视野内 2 个点位，另有 ${tenochtitlan.length} 个在视野外，列在结果列表的“视野外”分组中。`
    );
  });

  it("缩放按钮在全球视野禁用缩小，放大后取消预设选中", async () => {
    const user = setupUser();
    render(
      <StatefulMap points={[point("polity-cn-ming", "geo-ming-beijing")]} onSelect={vi.fn()} />
    );

    const zoomOut = screen.getByRole("button", { name: "缩小视野" });
    const zoomIn = screen.getByRole("button", { name: "放大视野" });
    expect(zoomOut).toBeDisabled();
    await user.click(zoomIn);
    expect(zoomOut).toBeEnabled();
    expect(screen.getByRole("button", { name: "全球" })).toHaveAttribute("aria-pressed", "false");

    for (let step = 0; step < 10; step += 1) {
      if (zoomIn.hasAttribute("disabled")) break;
      await user.click(zoomIn);
    }
    expect(zoomIn).toBeDisabled();
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
    expect(onSelect).toHaveBeenCalledWith("polity-cn-northern-wei");
  });

  it("按地图取景把点位分为视野内与视野外两组，各组保持输入顺序", () => {
    const tenochtitlan = selectMapSnapshots(
      [entity("polity-aztec-empire")],
      data.geographicSnapshots
    ).points;
    const beijing = point("polity-cn-ming", "geo-ming-beijing");
    const luoyang = point("polity-cn-northern-wei", "geo-northern-wei-luoyang");

    render(
      <MapResultList
        points={[...tenochtitlan, beijing, luoyang]}
        missingEntities={[]}
        comparisonEntityIds={[]}
        viewport={EAST_ASIA_VIEWPORT}
        onSelect={vi.fn()}
        onToggleComparison={vi.fn()}
      />
    );

    const results = screen.getByRole("region", { name: "地图结果列表" });
    expect(within(results).getByRole("heading", { name: "地图点位" })).toBeVisible();
    const headings = within(results).getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "视野内2 个",
      `视野外${tenochtitlan.length} 个`
    ]);
    const [inView, outOfView] = within(results).getAllByRole("list");
    expect(
      within(inView!)
        .getAllByRole("button", { name: /，(都城|政治中心|代表性中心)$/ })
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["明，北京，都城", "北魏，洛阳，都城"]);
    expect(within(outOfView!).getAllByRole("button", { name: /^阿兹特克帝国/ })).toHaveLength(
      tenochtitlan.length
    );
  });

  it("全部点位都在视野内或未传入取景时不显示分组标题", () => {
    const view = render(
      <MapResultList
        points={[point("polity-cn-ming", "geo-ming-beijing")]}
        missingEntities={[]}
        comparisonEntityIds={[]}
        viewport={GLOBAL_MAP_VIEWPORT}
        onSelect={vi.fn()}
        onToggleComparison={vi.fn()}
      />
    );
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();

    view.rerender(
      <MapResultList
        points={[point("polity-cn-ming", "geo-ming-beijing")]}
        missingEntities={[]}
        comparisonEntityIds={[]}
        onSelect={vi.fn()}
        onToggleComparison={vi.fn()}
      />
    );
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("悬停或聚焦结果行时通知地图高亮该点位，离开整行后清除", async () => {
    const user = setupUser();
    const onHighlightPoint = vi.fn();
    render(
      <>
        <MapResultList
          points={[
            point("polity-cn-ming", "geo-ming-beijing"),
            point("polity-cn-northern-wei", "geo-northern-wei-luoyang")
          ]}
          missingEntities={[]}
          comparisonEntityIds={[]}
          onHighlightPoint={onHighlightPoint}
          onSelect={vi.fn()}
          onToggleComparison={vi.fn()}
        />
        <button type="button">列表之后</button>
      </>
    );

    const beijing = screen.getByRole("button", { name: "明，北京，都城" });
    await user.hover(beijing);
    expect(onHighlightPoint).toHaveBeenLastCalledWith("geo-ming-beijing");
    await user.unhover(beijing);
    expect(onHighlightPoint).toHaveBeenLastCalledWith(null);

    onHighlightPoint.mockClear();
    beijing.focus();
    expect(onHighlightPoint).toHaveBeenLastCalledWith("geo-ming-beijing");
    // 在同一行内从详情按钮移到对比按钮，高亮保持不变。
    await user.tab();
    expect(screen.getByRole("button", { name: "将明加入对比" })).toHaveFocus();
    expect(onHighlightPoint).not.toHaveBeenCalledWith(null);
    await user.tab();
    expect(onHighlightPoint).toHaveBeenLastCalledWith("geo-northern-wei-luoyang");
    screen.getByRole("button", { name: "列表之后" }).focus();
    expect(onHighlightPoint).toHaveBeenLastCalledWith(null);
  });

  it("按结果列表指向高亮单点标记或包含该点位的聚合", () => {
    const beijing = point("polity-cn-ming", "geo-ming-beijing");
    const nanjing = point("polity-cn-ming", "geo-ming-nanjing");
    const luoyang = point("polity-cn-northern-wei", "geo-northern-wei-luoyang");
    const view = render(
      <StatefulMap
        points={[beijing, nanjing, luoyang]}
        clusterThresholdPercent={5}
        highlightedPointId="geo-northern-wei-luoyang"
        onSelect={vi.fn()}
      />
    );

    const cluster = screen.getByRole("button", { name: "此处有 3 个历史点位" });
    expect(cluster).toHaveClass("is-highlighted");

    view.rerender(
      <StatefulMap
        points={[beijing, luoyang]}
        clusterThresholdPercent={0.5}
        highlightedPointId="geo-northern-wei-luoyang"
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "北魏，洛阳，都城" })).toHaveClass("is-highlighted");
    expect(screen.getByRole("button", { name: "明，北京，都城" })).not.toHaveClass(
      "is-highlighted"
    );
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
