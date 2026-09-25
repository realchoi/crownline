import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { projectCoordinates, type MapPoint } from "../src/domain/mapSnapshots";
import {
  GLOBAL_MAP_VIEWPORT,
  MAP_VIEWPORT_PRESETS,
  MAX_MAP_ZOOM,
  clampViewport,
  partitionPointsByViewport,
  projectToViewport,
  selectViewportPoints,
  viewportFromBounds,
  zoomViewport
} from "../src/domain/mapViewport";

const data = await loadSourceData();

function pointAt(latitude: number, longitude: number): MapPoint {
  const [entity] = data.entities;
  const [snapshot] = data.geographicSnapshots;
  if (!entity || !snapshot) throw new Error("缺少地图测试数据");
  return { entity, snapshot, ...projectCoordinates({ latitude, longitude }) };
}

describe("地图视野", () => {
  it("全球视野不改变底图坐标", () => {
    const point = { xPercent: 12.5, yPercent: 80 };
    expect(projectToViewport(point, GLOBAL_MAP_VIEWPORT)).toEqual(point);
  });

  it("缩放受上下限约束，且视野不越出底图", () => {
    expect(clampViewport({ zoom: 20, centerX: 0, centerY: 100 })).toEqual({
      zoom: MAX_MAP_ZOOM,
      centerX: 50 / MAX_MAP_ZOOM,
      centerY: 100 - 50 / MAX_MAP_ZOOM
    });
    expect(zoomViewport(GLOBAL_MAP_VIEWPORT, 1 / 1.5)).toEqual(GLOBAL_MAP_VIEWPORT);
  });

  it("按经纬度范围取景时完整容纳该范围", () => {
    const bounds = { west: 73, east: 146, south: 15, north: 54 };
    const viewport = viewportFromBounds(bounds);
    const corners = [
      projectCoordinates({ latitude: bounds.north, longitude: bounds.west }),
      projectCoordinates({ latitude: bounds.south, longitude: bounds.east })
    ].map((corner) => projectToViewport(corner, viewport));

    corners.forEach(({ xPercent, yPercent }) => {
      expect(xPercent).toBeGreaterThanOrEqual(-1e-9);
      expect(xPercent).toBeLessThanOrEqual(100 + 1e-9);
      expect(yPercent).toBeGreaterThanOrEqual(-1e-9);
      expect(yPercent).toBeLessThanOrEqual(100 + 1e-9);
    });
    expect(viewport.zoom).toBeGreaterThan(1);
  });

  it("只返回视野内点位并换算为视野坐标", () => {
    const eastAsia = MAP_VIEWPORT_PRESETS.find(({ id }) => id === "east-asia")!;
    const viewport = viewportFromBounds(eastAsia.bounds);
    const beijing = pointAt(39.9, 116.4);
    const rome = pointAt(41.9, 12.5);

    const visible = selectViewportPoints([beijing, rome], viewport);
    expect(visible).toHaveLength(1);
    expect(visible[0]!.xPercent).toBeCloseTo(projectToViewport(beijing, viewport).xPercent);
  });

  it("按视野拆分结果时保持原顺序且不改写底图坐标", () => {
    const eastAsia = MAP_VIEWPORT_PRESETS.find(({ id }) => id === "east-asia")!;
    const viewport = viewportFromBounds(eastAsia.bounds);
    const rome = pointAt(41.9, 12.5);
    const beijing = pointAt(39.9, 116.4);
    const cairo = pointAt(30, 31.2);
    const kyoto = pointAt(35, 135.8);

    const { inView, outOfView } = partitionPointsByViewport(
      [rome, beijing, cairo, kyoto],
      viewport
    );
    expect(inView).toEqual([beijing, kyoto]);
    expect(outOfView).toEqual([rome, cairo]);
  });

  it("全球视野下所有点位都在视野内，视野边缘按闭区间计入", () => {
    const points = [pointAt(90, -180), pointAt(-90, 180), pointAt(0, 0)];
    expect(partitionPointsByViewport(points, GLOBAL_MAP_VIEWPORT)).toEqual({
      inView: points,
      outOfView: []
    });
  });

  it("每个已收录点位至少落在一个大区快捷视野中", () => {
    const regional = MAP_VIEWPORT_PRESETS.filter(({ id }) => id !== "global").map(({ bounds }) =>
      viewportFromBounds(bounds)
    );
    const uncovered = data.geographicSnapshots.filter(({ coordinates }) => {
      const point = pointAt(coordinates.latitude, coordinates.longitude);
      return regional.every((viewport) => selectViewportPoints([point], viewport).length === 0);
    });
    expect(uncovered.map(({ id }) => id)).toEqual([]);
  });
});
