import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import worldLandUrl from "../assets/maps/world-land.svg";
import { formatEntityNameWithLocal } from "../domain/entityNames";
import type { BoundaryMapShape } from "../domain/boundarySnapshots";
import type { MapLayer } from "../domain/browseState";
import {
  GEOGRAPHIC_ROLE_NAMES,
  MAP_CLUSTER_DISTANCE_PERCENT,
  clusterMapPoints,
  type MapPoint
} from "../domain/mapSnapshots";
import {
  GLOBAL_MAP_VIEW_STATE,
  MAP_VIEWPORT_PRESETS,
  MAP_ZOOM_STEP,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  selectViewportPoints,
  viewportFromBounds,
  zoomViewport,
  type MapViewState
} from "../domain/mapViewport";
import { EntityLocalName } from "./EntityLocalName";
import { HistoricalBoundaries } from "./HistoricalBoundaries";

interface HistoricalMapProps {
  points: MapPoint[];
  boundaries?: BoundaryMapShape[];
  mapLayer?: MapLayer;
  isOverview?: boolean;
  comparisonEntityIds?: string[];
  selectedEntityId?: string | null;
  /** 取景由外层持有，结果列表据此把视野内外分组。 */
  view: MapViewState;
  onViewChange: (view: MapViewState) => void;
  /** 结果列表当前指向的点位；地图高亮该标记或包含它的聚合。 */
  highlightedPointId?: string | null;
  /** 聚合半径，单位为当前视野宽度的百分比；缺省时按地图实际宽度保证标记不重叠。 */
  clusterThresholdPercent?: number;
  onSelect: (entityId: string) => void;
}

/** 26px 标记加少量间隙；窄屏地图上按像素换算聚合半径，避免标记互相遮挡。 */
const MARKER_SPACING_PX = 30;

function pointLabel({ entity, snapshot }: MapPoint): string {
  return `${formatEntityNameWithLocal(entity.names)}，${snapshot.placeName}，${GEOGRAPHIC_ROLE_NAMES[snapshot.role]}`;
}

/** 呈现离线世界轮廓、大区视野与缩放、单点标记与可展开的密集点位聚合。 */
export function HistoricalMap({
  points,
  boundaries = [],
  mapLayer = "points",
  isOverview = false,
  comparisonEntityIds = [],
  selectedEntityId = null,
  view,
  onViewChange,
  highlightedPointId = null,
  clusterThresholdPercent,
  onSelect
}: HistoricalMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState<number | null>(null);
  // 首次绘制前同步读取宽度，避免先按默认阈值聚合再闪动重排。
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCanvasWidth(canvas.getBoundingClientRect().width || null);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasWidth(entry?.contentRect.width || null);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  const threshold =
    clusterThresholdPercent ??
    (canvasWidth
      ? Math.max(MAP_CLUSTER_DISTANCE_PERCENT, (MARKER_SPACING_PX / canvasWidth) * 100)
      : MAP_CLUSTER_DISTANCE_PERCENT);
  const { viewport, presetId } = view;
  const visiblePoints = useMemo(() => selectViewportPoints(points, viewport), [points, viewport]);
  // 聚合在视野坐标中进行，放大后邻近点位会自然拆开。
  const clusters = useMemo(
    () => clusterMapPoints(visiblePoints, threshold),
    [threshold, visiblePoints]
  );
  const hiddenPointCount = points.length - visiblePoints.length;
  const worldLayerStyle = {
    width: `${viewport.zoom * 100}%`,
    height: `${viewport.zoom * 100}%`,
    left: `${-(viewport.centerX - 50 / viewport.zoom) * viewport.zoom}%`,
    top: `${-(viewport.centerY - 50 / viewport.zoom) * viewport.zoom}%`
  };
  const zoomBy = (factor: number) => {
    onViewChange({ viewport: zoomViewport(viewport, factor), presetId: null });
  };
  // 以聚合中的一个点位记录展开状态，视野或尺寸变化重新聚合时面板保持打开。
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null);
  const expandedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clusterPanelRef = useRef<HTMLElement | null>(null);
  const expandedCluster = clusters.find(({ points: clusterPoints }) => {
    return (
      clusterPoints.length > 1 &&
      clusterPoints.some(({ snapshot }) => snapshot.id === expandedPointId)
    );
  });
  const expandedClusterId = expandedCluster?.id;

  useEffect(() => {
    if (expandedClusterId) {
      clusterPanelRef.current?.querySelector<HTMLButtonElement>(".map-cluster-panel-item")?.focus();
    }
  }, [expandedClusterId]);

  return (
    <section
      className={`historical-map${expandedCluster ? " is-cluster-expanded" : ""}`}
      aria-label={isOverview ? "全时期历史政权总览地图" : "当前年份历史政权示意地图"}
    >
      <div className="map-viewport-controls">
        <div className="map-viewport-presets" role="group" aria-label="地图视野">
          {MAP_VIEWPORT_PRESETS.map(({ id, label, bounds }) => (
            <button
              key={id}
              type="button"
              aria-pressed={presetId === id}
              onClick={() => {
                onViewChange(
                  id === "global"
                    ? GLOBAL_MAP_VIEW_STATE
                    : { viewport: viewportFromBounds(bounds), presetId: id }
                );
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="map-zoom-controls" role="group" aria-label="地图缩放">
          <button
            type="button"
            aria-label="放大视野"
            disabled={viewport.zoom >= MAX_MAP_ZOOM}
            onClick={() => zoomBy(MAP_ZOOM_STEP)}
          >
            <span aria-hidden="true">＋</span>
          </button>
          <button
            type="button"
            aria-label="缩小视野"
            disabled={viewport.zoom <= MIN_MAP_ZOOM}
            onClick={() => zoomBy(1 / MAP_ZOOM_STEP)}
          >
            <span aria-hidden="true">−</span>
          </button>
        </div>
      </div>
      <p className="map-viewport-status" role="status">
        {hiddenPointCount > 0
          ? `视野内 ${visiblePoints.length} 个点位，另有 ${hiddenPointCount} 个在视野外，列在结果列表的“视野外”分组中。`
          : `视野内 ${visiblePoints.length} 个点位。`}
      </p>
      <div className="historical-map-canvas world-map" ref={canvasRef}>
        <div className="map-world-layer" style={worldLayerStyle}>
          <img className="historical-map-land" src={worldLandUrl} alt="" role="presentation" />
          {mapLayer !== "points" && !isOverview && (
            <HistoricalBoundaries
              boundaries={boundaries}
              comparisonEntityIds={comparisonEntityIds}
              selectedEntityId={selectedEntityId}
              onSelect={onSelect}
            />
          )}
        </div>
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
                className={`map-marker map-marker-${firstPoint.snapshot.role}${
                  firstPoint.snapshot.id === highlightedPointId ? " is-highlighted" : ""
                }`}
                key={cluster.id}
                type="button"
                style={style}
                aria-label={pointLabel(firstPoint)}
                onClick={() => onSelect(firstPoint.entity.id)}
              >
                <span aria-hidden="true" />
              </button>
            );
          }

          const expanded = expandedClusterId === cluster.id;
          const highlighted = cluster.points.some(
            ({ snapshot }) => snapshot.id === highlightedPointId
          );
          return (
            <div className="map-cluster" key={cluster.id} style={style}>
              <button
                className={`map-cluster-trigger${highlighted ? " is-highlighted" : ""}`}
                type="button"
                aria-label={`此处有 ${cluster.points.length} 个历史点位`}
                aria-expanded={expanded}
                aria-controls={expanded ? "map-cluster-panel" : undefined}
                onClick={(event) => {
                  if (!expanded) expandedTriggerRef.current = event.currentTarget;
                  setExpandedPointId(expanded ? null : firstPoint.snapshot.id);
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
            setExpandedPointId(null);
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
                setExpandedPointId(null);
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
                  onClick={() => onSelect(point.entity.id)}
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
          ? "疆域快照必须绑定明确年份；请选择或调整一个指定年份。所有填充均为示意而非精确历史勘界，不代表现代主权，也不能据此推断接壤或空间重叠。"
          : mapLayer !== "points"
            ? "疆域快照只适用于当前年份，是根据公开资料重建或简化的空间示意；不表示整个政权存续期、同等控制或现代主权，也不自动推断接壤、重叠或历史关系。"
            : isOverview
              ? "总览汇集不同时期的已校订点位，并不表示这些政权同时存在；点位也不表示疆域与控制范围。"
              : "点位仅表示已校订的都城、政治中心或浏览定位，不表示政权疆域与控制范围。"}
      </p>
    </section>
  );
}
