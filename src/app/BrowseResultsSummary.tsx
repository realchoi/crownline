import type { BrowseState } from "../domain/browseState";
import type { MapSelection } from "../domain/mapSnapshots";

interface BrowseResultsSummaryProps {
  browseState: BrowseState;
  resultCount: number;
  overviewTotal: number;
  overviewGroupCount: number;
  mapPolityCount: number;
  mapSelection: MapSelection | null;
}

/** Announces the currently composed result set without owning browse state. */
export function BrowseResultsSummary({
  browseState,
  resultCount,
  overviewTotal,
  overviewGroupCount,
  mapPolityCount,
  mapSelection
}: BrowseResultsSummaryProps) {
  return (
    <div className="results-line" role="status" aria-atomic="true">
      {browseState.viewMode === "map" ? (
        <>
          <span>
            {browseState.category === "context"
              ? "历史分期不进入地图；请选择真实政权类别。"
              : mapPolityCount === 0
                ? browseState.mode === "overview"
                  ? "没有匹配的政权。"
                  : "没有当年匹配的政权。"
                : mapSelection && mapSelection.points.length === 0
                  ? browseState.mode === "overview"
                    ? "有匹配政权，但这些政权尚未校订地理数据。"
                    : "当年有匹配政权，但这些政权尚未校订地理数据。"
                  : mapSelection
                    ? `${browseState.mode === "overview" ? "全时期总览：" : ""}显示 ${mapPolityCount} 个政权、${mapSelection.points.length} 个地图点位，${mapSelection.missingEntities.length} 个政权尚未校订地理数据。`
                    : "正在准备地图结果。"}
          </span>
          <span>
            {browseState.mode === "overview"
              ? "跨时期点位不表示这些政权同时存在"
              : "点位仅作历史浏览定位，不表示疆域"}
          </span>
        </>
      ) : browseState.mode === "overview" ? (
        <>
          <span>
            {browseState.regionScope.mode === "china"
              ? `显示 ${resultCount} / ${overviewTotal} 个条目，涉及 ${overviewGroupCount} 个历史阶段`
              : `显示 ${resultCount} / ${overviewTotal} 个条目，分为 ${overviewGroupCount} 个时间轴组`}
          </span>
          <span>点击任意时间条查看说明</span>
        </>
      ) : (
        <>
          <span>{`显示 ${mapPolityCount} 个政权，另有 ${resultCount - mapPolityCount} 条历史背景`}</span>
          <span>点击任意条目查看说明</span>
        </>
      )}
    </div>
  );
}
