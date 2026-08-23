import { formatEntityNameWithLocal } from "../domain/entityNames";
import type { BoundaryMapShape } from "../domain/boundarySnapshots";
import { BOUNDARY_PRECISION_NAMES } from "../domain/displayLabels";

interface HistoricalBoundariesProps {
  boundaries: BoundaryMapShape[];
  comparisonEntityIds: string[];
  selectedEntityId?: string | null;
  onSelect: (entityId: string, trigger: HTMLButtonElement | null) => void;
}

const BOUNDARY_COLORS = ["#8b5e3c", "#2e7180", "#766b35", "#765477", "#3f6b4f", "#a05b45"];

function stableColorIndex(entityId: string): number {
  return (
    [...entityId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7) %
    BOUNDARY_COLORS.length
  );
}

function boundaryLabel(shape: BoundaryMapShape): string {
  const interval = shape.snapshot.periods[0];
  const range = interval ? `${interval.start.year}—${interval.end.year}` : "适用时期未注明";
  return `${formatEntityNameWithLocal(shape.entity.names)}，${range}，${BOUNDARY_PRECISION_NAMES[shape.snapshot.boundaryPrecision]}疆域示意`;
}

/** SVG 视觉疆域层；键盘核心操作由地图下方的等价结果列表承担。 */
export function HistoricalBoundaries({
  boundaries,
  comparisonEntityIds,
  selectedEntityId,
  onSelect
}: HistoricalBoundariesProps) {
  return (
    <svg
      className="map-boundary-layer"
      viewBox="0 0 360 180"
      preserveAspectRatio="none"
      aria-label="当前年份的简化疆域示意"
      role="img"
    >
      {boundaries.flatMap((shape) => {
        const selected = comparisonEntityIds.includes(shape.entity.id);
        const focused = selectedEntityId === shape.entity.id;
        const color = BOUNDARY_COLORS[stableColorIndex(shape.entity.id)]!;
        return shape.paths.map((path, pathIndex) => (
          <path
            className={`map-boundary-shape${selected ? " is-comparison" : ""}${focused ? " is-focused" : ""}`}
            d={path}
            data-entity-id={shape.entity.id}
            fill={color}
            fillRule="evenodd"
            key={`${shape.snapshot.id}-${pathIndex}`}
            onClick={() => onSelect(shape.entity.id, null)}
            pointerEvents="all"
            aria-label={boundaryLabel(shape)}
          />
        ));
      })}
    </svg>
  );
}
