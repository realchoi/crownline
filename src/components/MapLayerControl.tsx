import type { MapLayer } from "../domain/browseState";

interface MapLayerControlProps {
  value: MapLayer;
  onChange: (layer: MapLayer) => void;
}

/**
 * 地图专属的图层开关：两个按钮分别切换地点标记与疆域示意，至少保留一层。
 * 放在地图结果区而非地图卡片内，疆域加载失败时仍可切回地点标记。
 */
export function MapLayerControl({ value, onChange }: MapLayerControlProps) {
  const showPoints = value !== "boundaries";
  const showBoundaries = value !== "points";

  return (
    <div className="map-layer-control">
      {/* fieldset 的 legend 无法参与网格排版；分组名称由下方 group 的 aria-label 提供。 */}
      <span className="field-label" aria-hidden="true">
        地图图层
      </span>
      <div className="map-layer-switch" role="group" aria-label="地图图层">
        <button
          type="button"
          aria-pressed={showPoints}
          onClick={() => {
            if (value === "combined") onChange("boundaries");
            else if (value === "boundaries") onChange("combined");
          }}
        >
          地点标记
        </button>
        <button
          type="button"
          aria-pressed={showBoundaries}
          onClick={() => {
            if (value === "combined") onChange("points");
            else if (value === "points") onChange("combined");
          }}
        >
          疆域示意
        </button>
      </div>
      <p className="map-layer-help">
        默认显示地点标记；开启疆域示意后两者叠加。疆域需要明确年份，且不代表精确勘界。
      </p>
    </div>
  );
}
