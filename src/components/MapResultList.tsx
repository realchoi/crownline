import type { HistoricalEntity } from "../domain/types";
import type { BoundaryMapShape } from "../domain/boundarySnapshots";
import type { MapLayer } from "../domain/browseState";
import { formatEntityNameWithLocal } from "../domain/entityNames";
import { BOUNDARY_PRECISION_NAMES, DETAIL_CONFIDENCE_NAMES } from "../domain/displayLabels";
import { GEOGRAPHIC_ROLE_NAMES, type MapPoint } from "../domain/mapSnapshots";
import { ComparisonToggle } from "./ComparisonToggle";
import { EntityLocalName } from "./EntityLocalName";

interface MapResultListProps {
  points: MapPoint[];
  boundaries?: BoundaryMapShape[];
  missingEntities: HistoricalEntity[];
  requiresBoundaryYear?: boolean;
  mapLayer?: MapLayer;
  isOverview?: boolean;
  comparisonEntityIds: string[];
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
  onToggleComparison: (entityId: string) => void;
}

function pointLabel({ entity, snapshot }: MapPoint): string {
  return `${formatEntityNameWithLocal(entity.names)}，${snapshot.placeName}，${GEOGRAPHIC_ROLE_NAMES[snapshot.role]}`;
}

/** 提供与地图标记等价的详情和对比操作入口。 */
export function MapResultList({
  points,
  boundaries = [],
  missingEntities,
  requiresBoundaryYear = false,
  mapLayer = "points",
  isOverview = false,
  comparisonEntityIds,
  onSelect,
  onToggleComparison
}: MapResultListProps) {
  return (
    <section className="map-results" aria-label="地图结果列表">
      <div className="map-results-heading">
        <div>
          <p className="timepoint-kicker">可访问结果</p>
          <h2>
            {mapLayer === "boundaries"
              ? isOverview
                ? "疆域快照"
                : "当前年份疆域"
              : mapLayer === "combined"
                ? "点位与疆域"
                : isOverview
                  ? "全时期点位"
                  : "地图点位"}
          </h2>
        </div>
        <span>
          {mapLayer === "boundaries"
            ? boundaries.length
            : points.length + (mapLayer === "combined" ? boundaries.length : 0)}{" "}
          个
        </span>
      </div>

      {mapLayer !== "boundaries" && points.length > 0 && (
        <ul className="map-results-list map-result-list">
          {points.map((point) => {
            const selected = comparisonEntityIds.includes(point.entity.id);
            return (
              <li
                className={`map-result-item${selected ? " is-comparison-selected" : ""}`}
                key={point.snapshot.id}
              >
                <button
                  className="map-result-detail"
                  type="button"
                  aria-label={pointLabel(point)}
                  onClick={(event) => onSelect(point.entity.id, event.currentTarget)}
                >
                  <span className={`map-result-role role-${point.snapshot.role}`}>
                    {GEOGRAPHIC_ROLE_NAMES[point.snapshot.role]}
                  </span>
                  <strong>{point.entity.names.primary}</strong>
                  <EntityLocalName names={point.entity.names} className="map-result-local-name" />
                  <span className="map-result-place">{point.snapshot.placeName}</span>
                  <small>{point.snapshot.positionNote}</small>
                </button>
                <ComparisonToggle
                  entityName={formatEntityNameWithLocal(point.entity.names)}
                  selected={selected}
                  disabled={comparisonEntityIds.length >= 2 && !selected}
                  onToggle={() => onToggleComparison(point.entity.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {mapLayer !== "points" && (
        <>
          {requiresBoundaryYear ? (
            <p className="empty-state compact-empty">
              疆域快照需要明确年份；拖动年份后才会显示适用时期的疆域。
            </p>
          ) : boundaries.length > 0 ? (
            <ul className="map-results-list map-boundary-result-list">
              {boundaries.map((boundary) => {
                const selected = comparisonEntityIds.includes(boundary.entity.id);
                const interval = boundary.snapshot.periods[0];
                const range = interval
                  ? `${interval.start.year}—${interval.end.year}`
                  : "时期未注明";
                return (
                  <li
                    className={`map-result-item map-boundary-result${selected ? " is-comparison-selected" : ""}`}
                    key={boundary.snapshot.id}
                  >
                    <button
                      className="map-result-detail"
                      type="button"
                      aria-label={`${boundary.entity.names.primary}，${range}，疆域示意`}
                      onClick={(event) => onSelect(boundary.entity.id, event.currentTarget)}
                    >
                      <span className="map-result-role boundary-result-role">
                        {BOUNDARY_PRECISION_NAMES[boundary.snapshot.boundaryPrecision]}
                      </span>
                      <strong>{boundary.entity.names.primary}</strong>
                      <EntityLocalName
                        names={boundary.entity.names}
                        className="map-result-local-name"
                      />
                      <span className="map-result-place">适用时期：{range}</span>
                      <small>
                        可信度：{DETAIL_CONFIDENCE_NAMES[boundary.snapshot.confidence]}。
                        {boundary.snapshot.boundaryNote}
                      </small>
                    </button>
                    <ComparisonToggle
                      entityName={formatEntityNameWithLocal(boundary.entity.names)}
                      selected={selected}
                      disabled={comparisonEntityIds.length >= 2 && !selected}
                      onToggle={() => onToggleComparison(boundary.entity.id)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state compact-empty">当前年份没有匹配的疆域快照。</p>
          )}
        </>
      )}

      {mapLayer === "points" && points.length === 0 && (
        <p className="empty-state compact-empty">当前筛选没有可显示的已校订点位。</p>
      )}

      {missingEntities.length > 0 && (
        <section
          className="map-missing"
          aria-label={mapLayer === "points" ? "尚未校订地理数据" : "尚未校订疆域数据"}
        >
          <h3>{mapLayer === "points" ? "尚未校订地理数据" : "尚未校订疆域数据"}</h3>
          <p>
            {mapLayer === "points"
              ? isOverview
                ? "这些已收录政权尚无可用点位；这不表示它们在地理上不存在。"
                : "这些政权在当前年份存在，但尚无可用点位；这不表示它们在地理上不存在。"
              : isOverview
                ? "这些已收录政权当前尚无可用疆域快照；这不表示它们没有疆域。"
                : "这些政权在当前年份尚无可用疆域快照；这不表示它们没有疆域。"}
          </p>
          <ul className="map-missing-list">
            {missingEntities.map((entity) => (
              <li key={entity.id}>{entity.names.primary}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
