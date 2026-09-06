import type { BrowseState, MapLayer } from "./browseState";
import type { BoundarySelection } from "./boundarySnapshots";
import type { MapSelection } from "./mapSnapshots";

export interface BrowseResultsSummary {
  primary: string;
  secondary: string;
}

interface BrowseResultsSummaryInput {
  browseState: BrowseState;
  resultCount: number;
  overviewTotal: number;
  overviewGroupCount: number;
  mapPolityCount: number;
  mapSelection: MapSelection | null;
  boundarySelection: BoundarySelection | null;
}

function pointSummary(
  browseState: BrowseState,
  mapPolityCount: number,
  mapSelection: MapSelection | null
): string {
  if (!mapSelection) return "正在准备地图点位。";
  if (mapSelection.points.length === 0) {
    return browseState.timeRange === "all"
      ? "有匹配政权，但这些政权尚未校订地理数据。"
      : "当年有匹配政权，但这些政权尚未校订地理数据。";
  }
  return `${browseState.timeRange === "all" ? "全时期总览：" : ""}显示 ${mapPolityCount} 个政权、${mapSelection.points.length} 个地图点位，${mapSelection.missingEntities.length} 个政权尚未校订地理数据。`;
}

function boundarySummary(
  browseState: BrowseState,
  mapPolityCount: number,
  boundarySelection: BoundarySelection | null
): string {
  if (!boundarySelection) return "正在准备疆域结果。";
  if (boundarySelection.requiresYear) {
    return "疆域快照需要明确年份；请选择或调整一个指定年份。";
  }
  if (boundarySelection.boundaries.length === 0) {
    return "有匹配政权，但当前年份尚无已校订疆域快照。";
  }
  return `显示 ${mapPolityCount} 个政权、${boundarySelection.boundaries.length} 条疆域快照，${boundarySelection.missingEntities.length} 个政权尚未校订疆域数据。`;
}

function combinedSummary(
  browseState: BrowseState,
  mapPolityCount: number,
  mapSelection: MapSelection | null,
  boundarySelection: BoundarySelection | null
): string {
  if (browseState.timeRange === "all") {
    if (!mapSelection) return "正在准备地图点位；疆域快照需要明确年份。";
    if (mapSelection.points.length === 0) {
      return "有匹配政权，但这些政权尚未校订地理数据；疆域快照需要明确年份。";
    }
    return `全时期总览：显示 ${mapPolityCount} 个政权、${mapSelection.points.length} 个地图点位；疆域快照需要明确年份。`;
  }

  const pointCount = mapSelection?.points.length ?? 0;
  const boundaryCount = boundarySelection?.boundaries.length ?? 0;
  if (mapSelection && boundarySelection) {
    if (pointCount === 0 && boundaryCount === 0) {
      return "有匹配政权，但当前年份尚无已校订点位或疆域快照。";
    }
    return `显示 ${mapPolityCount} 个政权、${pointCount} 个地图点位、${boundaryCount} 条疆域快照。`;
  }
  if (mapSelection) {
    return pointCount > 0
      ? `当前显示 ${mapPolityCount} 个政权、${pointCount} 个地图点位。`
      : "当前年份尚无已校订点位；疆域结果仍然可用。";
  }
  if (boundarySelection) {
    return boundaryCount > 0
      ? `当前显示 ${mapPolityCount} 个政权、${boundaryCount} 条疆域快照。`
      : "当前年份尚无已校订疆域快照；地图点位结果仍然可用。";
  }
  return "正在准备地图结果。";
}

function mapSecondaryText(browseState: BrowseState): string {
  if (browseState.mapLayer === "boundaries" || browseState.timeRange === "year") {
    return browseState.mapLayer === "points"
      ? "点位仅作历史浏览定位，不表示疆域"
      : "示意而非精确勘界；不据此推断接壤、重叠或现代主权";
  }
  return "跨时期点位不表示这些政权同时存在";
}

function getMapPrimaryText(
  browseState: BrowseState,
  mapPolityCount: number,
  mapSelection: MapSelection | null,
  boundarySelection: BoundarySelection | null
): string {
  if (browseState.category === "context") {
    return "历史分期不进入地图；请选择真实政权类别。";
  }
  if (mapPolityCount === 0) {
    return browseState.timeRange === "all" ? "没有匹配的政权。" : "没有当年匹配的政权。";
  }
  const summaries: Record<MapLayer, () => string> = {
    points: () => pointSummary(browseState, mapPolityCount, mapSelection),
    boundaries: () => boundarySummary(browseState, mapPolityCount, boundarySelection),
    combined: () => combinedSummary(browseState, mapPolityCount, mapSelection, boundarySelection)
  };
  return summaries[browseState.mapLayer]();
}

/** 将浏览状态与已准备的数据选择转换为稳定、可测试的用户可见摘要。 */
export function getBrowseResultsSummary({
  browseState,
  resultCount,
  overviewTotal,
  overviewGroupCount,
  mapPolityCount,
  mapSelection,
  boundarySelection
}: BrowseResultsSummaryInput): BrowseResultsSummary {
  if (browseState.viewMode === "map") {
    return {
      primary: getMapPrimaryText(browseState, mapPolityCount, mapSelection, boundarySelection),
      secondary: mapSecondaryText(browseState)
    };
  }
  if (browseState.timeRange === "all") {
    return {
      primary:
        browseState.regionScope.mode === "china"
          ? `显示 ${resultCount} / ${overviewTotal} 个条目，涉及 ${overviewGroupCount} 个历史阶段`
          : `显示 ${resultCount} / ${overviewTotal} 个条目，分为 ${overviewGroupCount} 个时间轴组`,
      secondary: "点击任意时间条查看说明"
    };
  }
  return {
    primary: `显示 ${mapPolityCount} 个政权，另有 ${resultCount - mapPolityCount} 条历史背景`,
    secondary: "点击任意条目查看说明"
  };
}
