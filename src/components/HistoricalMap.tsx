import { useEffect, useRef, useState } from "react";

import worldLandUrl from "../assets/maps/world-land.svg";
import { formatEntityNameWithLocal } from "../domain/entityNames";
import type { BoundaryMapShape } from "../domain/boundarySnapshots";
import type { MapLayer } from "../domain/browseState";
import { GEOGRAPHIC_ROLE_NAMES, type MapCluster, type MapPoint } from "../domain/mapSnapshots";
import { EntityLocalName } from "./EntityLocalName";
import { HistoricalBoundaries } from "./HistoricalBoundaries";

interface HistoricalMapProps {
  clusters: MapCluster[];
  boundaries?: BoundaryMapShape[];
  mapLayer?: MapLayer;
  isOverview?: boolean;
  comparisonEntityIds?: string[];
  selectedEntityId?: string | null;
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
}

function pointLabel({ entity, snapshot }: MapPoint): string {
  return `${formatEntityNameWithLocal(entity.names)}，${snapshot.placeName}，${GEOGRAPHIC_ROLE_NAMES[snapshot.role]}`;
}

/** 呈现离线世界轮廓、单点标记与可展开的密集点位聚合。 */
export function HistoricalMap({
  clusters,
  boundaries = [],
  mapLayer = "points",
  isOverview = false,
  comparisonEntityIds = [],
  selectedEntityId = null,
  onSelect
}: HistoricalMapProps) {
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const expandedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clusterPanelRef = useRef<HTMLElement | null>(null);
  const expandedCluster = clusters.find(({ id }) => id === expandedClusterId);

  useEffect(() => {
    if (expandedCluster) {
      clusterPanelRef.current?.querySelector<HTMLButtonElement>(".map-cluster-panel-item")?.focus();
    }
  }, [expandedCluster]);

  return (
    <section
      className={`historical-map${expandedCluster ? " is-cluster-expanded" : ""}`}
      aria-label={isOverview ? "全时期历史政权总览地图" : "当前年份历史政权示意地图"}
    >
      <div className="historical-map-canvas world-map">
        <img className="historical-map-land" src={worldLandUrl} alt="" role="presentation" />
        {mapLayer !== "points" && !isOverview && (
          <HistoricalBoundaries
            boundaries={boundaries}
            comparisonEntityIds={comparisonEntityIds}
            selectedEntityId={selectedEntityId}
            onSelect={(entityId) => onSelect(entityId, document.createElement("button"))}
          />
        )}
        {clusters.map((cluster) => {
          const [firstPoint] = cluster.points;
          if (!firstPoint) return null;
          const style = {
            left: `${cluster.xPercent}%`,
            top: `${cluster.yPercent}%`
          };
          if (cluster.points.length === 1) {
            return (
              <button
                className={`map-marker map-marker-${firstPoint.snapshot.role}`}
                key={cluster.id}
                type="button"
                style={style}
                aria-label={pointLabel(firstPoint)}
                onClick={(event) => onSelect(firstPoint.entity.id, event.currentTarget)}
              >
                <span aria-hidden="true" />
              </button>
            );
          }

          const expanded = expandedClusterId === cluster.id;
          return (
            <div className="map-cluster" key={cluster.id} style={style}>
              <button
                className="map-cluster-trigger"
                type="button"
                aria-label={`此处有 ${cluster.points.length} 个历史点位`}
                aria-expanded={expanded}
                aria-controls={expanded ? "map-cluster-panel" : undefined}
                onClick={(event) => {
                  if (!expanded) expandedTriggerRef.current = event.currentTarget;
                  setExpandedClusterId(expanded ? null : cluster.id);
                }}
              >
                <span aria-hidden="true">{cluster.points.length}</span>
              </button>
            </div>
          );
        })}
      </div>
      {expandedCluster && (
        <section
          id="map-cluster-panel"
          className="map-cluster-panel"
          aria-label="聚合历史点位"
          ref={clusterPanelRef}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setExpandedClusterId(null);
            expandedTriggerRef.current?.focus();
          }}
        >
          <header className="map-cluster-panel-heading">
            <div>
              <p className="timepoint-kicker">地图聚合</p>
              <h2>此处有 {expandedCluster.points.length} 个历史点位</h2>
              <p>选择一个政权查看详情，或从下方结果列表加入对比。</p>
            </div>
            <button
              className="map-cluster-panel-close"
              type="button"
              aria-label="关闭聚合点位"
              onClick={() => {
                setExpandedClusterId(null);
                expandedTriggerRef.current?.focus();
              }}
            >
              关闭
            </button>
          </header>
          <ul className="map-cluster-panel-list">
            {expandedCluster.points.map((point, index) => (
              <li key={point.snapshot.id}>
                <button
                  className="map-cluster-panel-item"
                  type="button"
                  aria-label={pointLabel(point)}
                  onClick={(event) => onSelect(point.entity.id, event.currentTarget)}
                >
                  <span className="map-cluster-panel-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="map-cluster-panel-copy">
                    <strong>{point.entity.names.primary}</strong>
                    <EntityLocalName names={point.entity.names} className="map-point-local-name" />
                    <span className="map-cluster-panel-place">
                      {point.snapshot.placeName} · {GEOGRAPHIC_ROLE_NAMES[point.snapshot.role]}
                    </span>
                    <small>{point.snapshot.positionNote}</small>
                  </span>
                  <span className="map-cluster-panel-action" aria-hidden="true">
                    查看详情
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="map-legend-stack">
        {(mapLayer === "points" || mapLayer === "combined") && (
          <ul className="map-marker-legend" aria-label="地图点位图例">
            <li>
              <span className="map-legend-symbol map-legend-capital" aria-hidden="true" />
              <span>都城</span>
            </li>
            <li>
              <span className="map-legend-symbol map-legend-political-center" aria-hidden="true" />
              <span>政治中心</span>
            </li>
            <li>
              <span
                className="map-legend-symbol map-legend-representative-center"
                aria-hidden="true"
              />
              <span>代表性中心</span>
            </li>
            <li>
              <span className="map-legend-symbol map-legend-cluster" aria-hidden="true">
                2
              </span>
              <span>数字表示邻近点位聚合</span>
            </li>
          </ul>
        )}
        {mapLayer !== "points" && (
          <div className="map-boundary-legend" aria-label="疆域图层图例">
            <span className="map-boundary-legend-swatch" aria-hidden="true" />
            <span>低饱和填充：按政权稳定配色的简化疆域示意</span>
          </div>
        )}
      </div>
      <p className="map-boundary-note">
        {mapLayer !== "points" && isOverview
          ? "疆域快照必须绑定明确年份；请拖动年份进入时间点地图。所有填充均为示意而非精确历史勘界，不代表现代主权，也不能据此推断接壤或空间重叠。"
          : mapLayer !== "points"
            ? "疆域快照只适用于当前年份，是根据公开资料重建或简化的空间示意；不表示整个政权存续期、同等控制或现代主权，也不自动推断接壤、重叠或历史关系。"
            : isOverview
              ? "总览汇集不同时期的已校订点位，并不表示这些政权同时存在；点位也不表示疆域与控制范围。"
              : "点位仅表示已校订的都城、政治中心或浏览定位，不表示政权疆域与控制范围。"}
      </p>
    </section>
  );
}
