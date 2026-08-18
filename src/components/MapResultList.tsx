import type { HistoricalEntity } from "../domain/types";
import { GEOGRAPHIC_ROLE_NAMES, type MapPoint } from "../domain/mapSnapshots";
import { ComparisonToggle } from "./ComparisonToggle";

interface MapResultListProps {
  points: MapPoint[];
  missingEntities: HistoricalEntity[];
  comparisonEntityIds: string[];
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
  onToggleComparison: (entityId: string) => void;
}

function pointLabel({ entity, snapshot }: MapPoint): string {
  return `${entity.names.primary}，${snapshot.placeName}，${GEOGRAPHIC_ROLE_NAMES[snapshot.role]}`;
}

/** 提供与地图标记等价的详情和对比操作入口。 */
export function MapResultList({
  points,
  missingEntities,
  comparisonEntityIds,
  onSelect,
  onToggleComparison
}: MapResultListProps) {
  return (
    <section className="map-results" aria-label="地图结果列表">
      <div className="map-results-heading">
        <div>
          <p className="timepoint-kicker">可访问结果</p>
          <h2>地图点位</h2>
        </div>
        <span>{points.length} 个</span>
      </div>

      {points.length > 0 ? (
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
                  <span className="map-result-place">{point.snapshot.placeName}</span>
                  <small>{point.snapshot.positionNote}</small>
                </button>
                <ComparisonToggle
                  entityName={point.entity.names.primary}
                  selected={selected}
                  disabled={comparisonEntityIds.length >= 2}
                  onToggle={() => onToggleComparison(point.entity.id)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state compact-empty">当前筛选没有可显示的已校订点位。</p>
      )}

      {missingEntities.length > 0 && (
        <section className="map-missing" aria-label="尚未校订地理数据">
          <h3>尚未校订地理数据</h3>
          <p>这些政权在当前年份存在，但尚无可用点位；这不表示它们在地理上不存在。</p>
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
