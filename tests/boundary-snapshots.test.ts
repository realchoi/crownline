import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import {
  projectMultiPolygonToSvgPaths,
  selectBoundarySnapshots,
  validateBoundaryGeometry
} from "../src/domain/boundarySnapshots";

const data = await loadSourceData();

function entity(id: string) {
  const result = data.entities.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`缺少测试实体 ${id}`);
  return result;
}

describe("历史疆域快照领域层", () => {
  it("按年份选择正确快照并返回缺少数据的真实政权", () => {
    const result = selectBoundarySnapshots(
      [entity("polity-abbasid-caliphate"), entity("polity-byzantine-empire")],
      data.boundarySnapshots,
      800
    );

    expect(result.boundaries.map(({ snapshot }) => snapshot.id)).toEqual([
      "boundary-abbasid-750-861",
      "boundary-byzantine-800-1025"
    ]);
    expect(result.missingEntities).toEqual([]);
    expect(result.requiresYear).toBe(false);
  });

  it("不指定年份时拒绝把跨时代疆域拼成总览", () => {
    const result = selectBoundarySnapshots(
      [entity("polity-ottoman-empire")],
      data.boundarySnapshots
    );

    expect(result.boundaries).toEqual([]);
    expect(result.missingEntities.map(({ id }) => id)).toEqual(["polity-ottoman-empire"]);
    expect(result.requiresYear).toBe(true);
  });

  it("输入顺序不影响输出，且多个政权可以在同年同时命中", () => {
    const polities = [entity("polity-byzantine-empire"), entity("polity-abbasid-caliphate")];
    const forward = selectBoundarySnapshots(polities, data.boundarySnapshots, 800);
    const reverse = selectBoundarySnapshots(
      [...polities].reverse(),
      [...data.boundarySnapshots].reverse(),
      800
    );

    expect(reverse).toEqual(forward);
  });

  it("稳定投影 MultiPolygon、多块区域和洞环", () => {
    const geometry = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0]
          ],
          [
            [2, 2],
            [2, 4],
            [4, 4],
            [4, 2],
            [2, 2]
          ]
        ],
        [
          [
            [20, 0],
            [25, 0],
            [25, 5],
            [20, 5],
            [20, 0]
          ]
        ]
      ]
    };

    expect(validateBoundaryGeometry(geometry)).toEqual([]);
    expect(projectMultiPolygonToSvgPaths(geometry)).toEqual([
      "M180 90 L190 90 L190 80 L180 80 L180 90 Z M182 88 L182 86 L184 86 L184 88 L182 88 Z",
      "M200 90 L205 90 L205 85 L200 85 L200 90 Z"
    ]);
  });

  it("拒绝跨反经线几何，并且不提供接壤或重叠推断", () => {
    const geometry = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [170, 0],
            [-170, 0],
            [-170, 10],
            [170, 10],
            [170, 0]
          ]
        ]
      ]
    };
    expect(validateBoundaryGeometry(geometry)).toContainEqual(
      expect.objectContaining({ code: "ANTIMERIDIAN_BOUNDARY" })
    );
    expect("touches" in selectBoundarySnapshots).toBe(false);
  });
});
