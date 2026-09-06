import { describe, expect, it } from "vitest";

import { getBrowseResultsSummary } from "../src/domain/browseResultsSummary";
import { readBrowseState } from "../src/domain/browseState";
import type { BoundarySelection } from "../src/domain/boundarySnapshots";
import type { MapSelection } from "../src/domain/mapSnapshots";

const bounds = { min: -2000, max: 2000 };
const emptyMap: MapSelection = { points: [], clusters: [], missingEntities: [] };
const emptyBoundaries: BoundarySelection = {
  boundaries: [],
  missingEntities: [],
  requiresYear: false
};

describe("浏览结果摘要", () => {
  it("纯疆域摘要不依赖地理选择结果", () => {
    const browseState = readBrowseState("?view=map&mode=point&year=800&layer=boundaries", bounds);
    const summary = getBrowseResultsSummary({
      browseState,
      resultCount: 3,
      overviewTotal: 3,
      overviewGroupCount: 1,
      mapPolityCount: 3,
      mapSelection: null,
      boundarySelection: {
        ...emptyBoundaries,
        boundaries: [{} as BoundarySelection["boundaries"][number]],
        missingEntities: [{ id: "missing" } as BoundarySelection["missingEntities"][number]]
      }
    });

    expect(summary.primary).toBe("显示 3 个政权、1 条疆域快照，1 个政权尚未校订疆域数据。");
  });

  it("组合图层只准备好疆域时仍报告可见结果", () => {
    const browseState = readBrowseState("?view=map&mode=point&year=800&layer=combined", bounds);
    const summary = getBrowseResultsSummary({
      browseState,
      resultCount: 3,
      overviewTotal: 3,
      overviewGroupCount: 1,
      mapPolityCount: 3,
      mapSelection: null,
      boundarySelection: {
        ...emptyBoundaries,
        boundaries: [{} as BoundarySelection["boundaries"][number]]
      }
    });

    expect(summary.primary).toBe("当前显示 3 个政权、1 条疆域快照。");
  });

  it("组合图层全时期保留点位统计并说明疆域需要年份", () => {
    const browseState = readBrowseState("?view=map&layer=combined", bounds);
    const summary = getBrowseResultsSummary({
      browseState,
      resultCount: 3,
      overviewTotal: 3,
      overviewGroupCount: 1,
      mapPolityCount: 3,
      mapSelection: {
        ...emptyMap,
        points: [{} as MapSelection["points"][number]]
      },
      boundarySelection: { ...emptyBoundaries, requiresYear: true }
    });

    expect(summary.primary).toBe("全时期总览：显示 3 个政权、1 个地图点位；疆域快照需要明确年份。");
  });
});
