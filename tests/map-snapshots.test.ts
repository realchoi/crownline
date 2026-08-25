import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import {
  clusterMapPoints,
  GEOGRAPHIC_ROLE_NAMES,
  projectCoordinates,
  selectMapSnapshots
} from "../src/domain/mapSnapshots";

const data = await loadSourceData();

function entity(id: string) {
  const result = data.entities.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`缺少测试实体 ${id}`);
  return result;
}

function snapshot(id: string) {
  const result = data.geographicSnapshots.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`缺少测试地理快照 ${id}`);
  return result;
}

describe("历史地图点位", () => {
  it("把经纬度边界投影到百分比坐标", () => {
    expect(projectCoordinates({ latitude: 90, longitude: -180 })).toEqual({
      xPercent: 0,
      yPercent: 0
    });
    expect(projectCoordinates({ latitude: 0, longitude: 0 })).toEqual({
      xPercent: 50,
      yPercent: 50
    });
    expect(projectCoordinates({ latitude: -90, longitude: 180 })).toEqual({
      xPercent: 100,
      yPercent: 100
    });
  });

  it("按闭区间端点切换拜占庭政治中心", () => {
    const polity = entity("polity-byzantine-empire");
    const snapshots = [snapshot("geo-byzantine-constantinople"), snapshot("geo-byzantine-nicaea")];

    expect(
      selectMapSnapshots([polity], snapshots, 1203).points.map(({ snapshot }) => snapshot.id)
    ).toEqual(["geo-byzantine-constantinople"]);
    expect(
      selectMapSnapshots([polity], snapshots, 1204).points.map(({ snapshot }) => snapshot.id)
    ).toEqual(["geo-byzantine-nicaea"]);
  });

  it("按年份选择本批次的中国迁都快照", () => {
    const hanZhao = entity("polity-cn-han-zhao");
    const hanZhaoSnapshots = data.geographicSnapshots.filter(
      ({ polityId }) => polityId === "polity-cn-han-zhao"
    );
    expect(
      selectMapSnapshots([hanZhao], hanZhaoSnapshots, 318).points.map(({ snapshot }) => snapshot.id)
    ).toEqual(["geo-han-zhao-pingyang"]);
    expect(
      selectMapSnapshots([hanZhao], hanZhaoSnapshots, 319).points.map(({ snapshot }) => snapshot.id)
    ).toEqual(["geo-han-zhao-changan"]);

    const laterJin = entity("polity-cn-later-jin-jurchen");
    const laterJinSnapshots = data.geographicSnapshots.filter(
      ({ polityId }) => polityId === "polity-cn-later-jin-jurchen"
    );
    expect(
      selectMapSnapshots([laterJin], laterJinSnapshots, 1621).points.map(
        ({ snapshot }) => snapshot.placeName
      )
    ).toEqual(["赫图阿拉"]);
    expect(
      selectMapSnapshots([laterJin], laterJinSnapshots, 1625).points.map(
        ({ snapshot }) => snapshot.placeName
      )
    ).toEqual(["盛京"]);
  });

  it("不把唐的中断期误判为可见点位", () => {
    const polity = entity("polity-cn-tang");
    const snapshots = [snapshot("geo-tang-changan")];

    expect(selectMapSnapshots([polity], snapshots, 690).points).toHaveLength(1);
    expect(selectMapSnapshots([polity], snapshots, 691)).toMatchObject({
      points: [],
      missingEntities: [polity]
    });
    expect(selectMapSnapshots([polity], snapshots, 705).points).toHaveLength(1);
  });

  it("保留同一政权同年并存的多个有效中心", () => {
    const polity = entity("polity-cn-tang");
    const changan = snapshot("geo-tang-changan");
    const luoyang = {
      ...structuredClone(changan),
      id: "geo-tang-luoyang-test",
      placeName: "洛阳",
      coordinates: { latitude: 34.6197, longitude: 112.454 }
    };

    expect(
      selectMapSnapshots([polity], [luoyang, changan], 650).points.map(
        ({ snapshot }) => snapshot.placeName
      )
    ).toEqual(["长安", "洛阳"]);
  });

  it("未指定年份时选择政权的全部已校订历史点位", () => {
    const ming = entity("polity-cn-ming");
    const result = selectMapSnapshots([ming], data.geographicSnapshots);

    expect(result.points.map(({ snapshot }) => snapshot.id)).toEqual([
      "geo-ming-beijing",
      "geo-ming-nanjing"
    ]);
    expect(result.missingEntities).toEqual([]);
  });

  it("全览模式保留本批次迁都政权的多个时期点位", () => {
    const laterJin = entity("polity-cn-later-jin-jurchen");
    const result = selectMapSnapshots(
      [laterJin],
      data.geographicSnapshots.filter(({ polityId }) => polityId === laterJin.id)
    );
    expect(result.points.map(({ snapshot }) => snapshot.id)).toEqual([
      "geo-later-jin-jurchen-shengjing",
      "geo-later-jin-jurchen-hetuala"
    ]);
    expect(result.missingEntities).toEqual([]);
  });

  it("单独列出正式审查后仍不提供单一地理点位的夏", () => {
    const xia = entity("polity-cn-xia");
    const result = selectMapSnapshots([xia], data.geographicSnapshots, -1800);

    expect(result.points).toEqual([]);
    expect(result.clusters).toEqual([]);
    expect(result.missingEntities).toEqual([xia]);
  });

  it("不受输入顺序影响地稳定聚合北京与南京测试点", () => {
    const ming = entity("polity-cn-ming");
    const beijing = snapshot("geo-ming-beijing");
    const nanjing = {
      ...snapshot("geo-ming-nanjing"),
      periods: structuredClone(beijing.periods)
    };
    const forward = selectMapSnapshots([ming], [beijing, nanjing], 1500).points;
    const reverse = selectMapSnapshots([ming], [nanjing, beijing], 1500).points;

    expect(clusterMapPoints(forward, 5)).toEqual(clusterMapPoints(reverse, 5));
    expect(clusterMapPoints(forward, 5)).toMatchObject([
      {
        id: "map-cluster:geo-ming-beijing+geo-ming-nanjing",
        points: [{ snapshot: { id: "geo-ming-beijing" } }, { snapshot: { id: "geo-ming-nanjing" } }]
      }
    ]);
  });

  it("提供地理角色的中文名称", () => {
    expect(GEOGRAPHIC_ROLE_NAMES).toEqual({
      capital: "都城",
      "political-center": "政治中心",
      "representative-center": "代表性中心"
    });
  });
});
