import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { selectBrowseResults } from "../src/domain/selectors";
import { sortTimepointMatches } from "../src/domain/timepointOrder";

const data = await loadSourceData();

describe("年份切片排序", () => {
  const polities = selectBrowseResults(data, {
    query: "",
    category: "all",
    year: 1200,
    regionScope: { mode: "china" }
  }).polities;
  const names = (matches: typeof polities) => matches.map(({ entity }) => entity.names.primary);

  it("主线王朝优先，其次主要并立政权与区域政权，同类按起始年代", () => {
    expect(names(sortTimepointMatches(polities))).toEqual(["南宋", "西夏", "金", "大理"]);
  });

  it("结果不受输入顺序影响", () => {
    expect(names(sortTimepointMatches([...polities].reverse()))).toEqual(
      names(sortTimepointMatches(polities))
    );
  });
});
