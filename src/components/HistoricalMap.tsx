import { useEffect, useRef, useState } from "react";

import worldLandUrl from "../assets/maps/world-land.svg";
import { GEOGRAPHIC_ROLE_NAMES, type MapCluster, type MapPoint } from "../domain/mapSnapshots";

interface HistoricalMapProps {
  clusters: MapCluster[];
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
}

function pointLabel({ entity, snapshot }: MapPoint): string {
  return `${entity.names.primary}，${snapshot.placeName}，${GEOGRAPHIC_ROLE_NAMES[snapshot.role]}`;
}

/** 呈现离线世界轮廓、单点标记与可展开的密集点位聚合。 */
export function HistoricalMap({ clusters, onSelect }: HistoricalMapProps) {
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const expandedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clusterPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (expandedClusterId) {
      clusterPanelRef.current?.querySelector("button")?.focus();
    }
  }, [expandedClusterId]);

  return (
    <section className="historical-map" aria-label="当前年份历史政权示意地图">
      <div className="historical-map-canvas world-map">
        <img className="historical-map-land" src={worldLandUrl} alt="" role="presentation" />
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
                onClick={(event) => {
                  if (!expanded) expandedTriggerRef.current = event.currentTarget;
                  setExpandedClusterId(expanded ? null : cluster.id);
                }}
              >
                <span aria-hidden="true">{cluster.points.length}</span>
              </button>
              {expanded && (
                <section
                  className="map-cluster-popover map-cluster-panel"
                  aria-label="聚合历史点位"
                  ref={clusterPanelRef}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    setExpandedClusterId(null);
                    expandedTriggerRef.current?.focus();
                  }}
                >
                  <ul>
                    {cluster.points.map((point) => (
                      <li key={point.snapshot.id}>
                        <button
                          type="button"
                          aria-label={pointLabel(point)}
                          onClick={(event) => onSelect(point.entity.id, event.currentTarget)}
                        >
                          <strong>{point.entity.names.primary}</strong>
                          <span>{point.snapshot.placeName}</span>
                          <small>{GEOGRAPHIC_ROLE_NAMES[point.snapshot.role]}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          );
        })}
      </div>
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
          <span className="map-legend-symbol map-legend-representative-center" aria-hidden="true" />
          <span>代表性中心</span>
        </li>
        <li>
          <span className="map-legend-symbol map-legend-cluster" aria-hidden="true">
            2
          </span>
          <span>数字表示邻近点位聚合</span>
        </li>
      </ul>
      <p className="map-boundary-note">
        点位仅表示已校订的都城、政治中心或浏览定位，不表示政权疆域与控制范围。
      </p>
    </section>
  );
}
