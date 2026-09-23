import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildDataCoverageReport } from "../src/data/coverageReport";
import { isYearInPeriods } from "../src/domain/chronology";
import type { GeographicSnapshot } from "../src/domain/types";

const data = await loadSourceData();
const report = buildDataCoverageReport(data);
const activePlaces = (polityId: string, year: number) =>
  data.geographicSnapshots
    .filter((snapshot) => snapshot.polityId === polityId && isYearInPeriods(year, snapshot.periods))
    .map(({ placeName }) => placeName)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
const geographyCoverage = (polityId: string) =>
  report.temporalCoverage.polities.find(({ entityId }) => entityId === polityId)?.geography;
const snapshotById = (id: string) =>
  data.geographicSnapshots.find((snapshot) => snapshot.id === id);
const exactPeriod = (start: number, end: number) => ({
  start: { year: start, precision: "exact" as const },
  end: { year: end, precision: "exact" as const }
});

/**
 * 迁都年按“年内曾存在”闭区间保留两地；没有连续驻地或直接证据的年份保持空白，
 * 不从政权存续期推定都城。
 */
const CAPITAL_TRANSITIONS: Array<[polityId: string, year: number, places: string[]]> = [
  ["polity-cn-western-liang", 400, ["敦煌"]],
  ["polity-cn-western-liang", 405, ["敦煌", "酒泉"]],
  ["polity-cn-western-liang", 410, ["酒泉"]],
  ["polity-cn-western-liang", 420, ["敦煌", "酒泉"]],
  ["polity-cn-western-liang", 421, ["敦煌"]],
  ["polity-cn-western-liang", 422, []],
  ["polity-cn-former-yan", 336, []],
  ["polity-cn-former-yan", 337, ["棘城"]],
  ["polity-cn-former-yan", 341, ["棘城"]],
  ["polity-cn-former-yan", 342, ["棘城", "龙城"]],
  ["polity-cn-former-yan", 349, ["龙城"]],
  ["polity-cn-former-yan", 350, ["蓟城"]],
  ["polity-cn-former-yan", 357, ["蓟城", "邺城"]],
  ["polity-cn-former-yan", 358, ["邺城"]],
  ["polity-cn-former-yan", 370, ["邺城"]],
  ["polity-cn-former-yan", 371, []],
  ["polity-cn-western-qin", 384, []],
  ["polity-cn-western-qin", 385, ["勇士城"]],
  ["polity-cn-western-qin", 388, ["金城", "勇士城"]],
  ["polity-cn-western-qin", 394, ["金城"]],
  ["polity-cn-western-qin", 395, ["金城", "苑川"]],
  ["polity-cn-western-qin", 400, ["苑川"]],
  ["polity-cn-western-qin", 409, ["度坚山", "苑川"]],
  ["polity-cn-western-qin", 410, ["苑川"]],
  ["polity-cn-western-qin", 412, ["枹罕", "谭郊", "苑川"]],
  ["polity-cn-western-qin", 429, ["枹罕"]],
  ["polity-cn-western-qin", 430, ["南安"]],
  ["polity-cn-western-qin", 431, ["南安"]],
  ["polity-cn-western-qin", 432, []],
  ["polity-cn-sui", 581, ["长安旧城"]],
  ["polity-cn-sui", 582, ["长安旧城"]],
  ["polity-cn-sui", 583, ["大兴城"]],
  ["polity-cn-tang", 904, ["洛阳", "长安"]],
  ["polity-cn-tang", 905, ["洛阳"]],
  ["polity-cn-tang", 907, ["洛阳"]],
  ["polity-cn-yuan", 1271, ["上都"]],
  ["polity-cn-yuan", 1272, ["大都", "上都"]],
  ["polity-cn-yuan", 1364, ["大都", "上都"]],
  ["polity-cn-yuan", 1365, ["大都"]],
  ["polity-cn-southern-ming", 1644, ["南京"]],
  ["polity-cn-southern-ming", 1645, ["福州", "南京"]],
  ["polity-cn-southern-ming", 1646, ["福州"]],
  ["polity-cn-southern-ming", 1647, ["桂林"]],
  ["polity-cn-southern-ming", 1648, []],
  ["polity-cn-southern-ming", 1649, ["南宁"]],
  ["polity-cn-southern-ming", 1651, ["南宁"]],
  ["polity-cn-southern-ming", 1652, ["安龙"]],
  ["polity-cn-southern-ming", 1656, ["安龙", "昆明"]],
  ["polity-cn-southern-ming", 1659, ["昆明"]],
  ["polity-cn-southern-ming", 1660, []],
  ["polity-holy-roman-empire", 1024, ["Aachen"]],
  ["polity-holy-roman-empire", 1025, []],
  ["polity-holy-roman-empire", 1662, []],
  ["polity-holy-roman-empire", 1663, ["Regensburg"]],
  ["polity-holy-roman-empire", 1806, ["Regensburg"]],
  ["polity-holy-roman-empire", 1807, []],
  ["polity-abbasid-caliphate", 761, []],
  ["polity-abbasid-caliphate", 762, ["Baghdad"]],
  ["polity-abbasid-caliphate", 835, ["Baghdad"]],
  ["polity-abbasid-caliphate", 836, ["Samarra"]],
  ["polity-abbasid-caliphate", 892, ["Samarra"]],
  ["polity-abbasid-caliphate", 893, ["Baghdad"]]
];

/** 流动、流亡、巡回宫廷或缺少直接证据的阶段刻意保留为未知，不以相邻点位填补。 */
const RETAINED_GEOGRAPHY_GAPS: Array<
  [polityId: string, unknownPeriods: Array<{ startYear: number; endYear: number }>]
> = [
  ["polity-cn-western-liang", []],
  ["polity-cn-former-yan", []],
  ["polity-cn-western-qin", []],
  ["polity-cn-sui", []],
  ["polity-cn-tang", []],
  ["polity-cn-yuan", []],
  ["polity-cn-southern-song", [{ startYear: 1127, endYear: 1128 }]],
  [
    "polity-cn-southern-ming",
    [
      { startYear: 1648, endYear: 1648 },
      { startYear: 1660, endYear: 1662 }
    ]
  ],
  ["polity-holy-roman-empire", [{ startYear: 1025, endYear: 1662 }]],
  ["polity-abbasid-caliphate", [{ startYear: 750, endYear: 761 }]],
  ["polity-khwarazmian-empire", [{ startYear: 1221, endYear: 1224 }]]
];

/** 纠正过“点位区间直接照抄政权存续期”或误配城市的记录，保留采用的直接证据年份。 */
const CORRECTED_PERIODS: Array<[snapshotId: string, periods: GeographicSnapshot["periods"]]> = [
  ["geo-western-han-changan", [exactPeriod(-200, 8)]],
  ["geo-sui-daxing", [exactPeriod(583, 618)]],
  ["geo-tang-changan", [exactPeriod(618, 690), exactPeriod(705, 904)]],
  ["geo-yuan-dadu", [exactPeriod(1272, 1368)]],
  ["geo-abbasid-baghdad", [exactPeriod(762, 835), exactPeriod(893, 1258)]],
  [
    "geo-ethiopian-gondar",
    [{ start: { year: 1636, precision: "exact" }, end: { year: 1769, precision: "circa" } }]
  ],
  ["geo-byzantine-nicaea", [exactPeriod(1204, 1261)]],
  ["geo-mughal-fatehpur-sikri", [exactPeriod(1571, 1585)]],
  ["geo-goryeo-ganghwa", [exactPeriod(1232, 1270)]],
  ["geo-eastern-wu-wuchang", [exactPeriod(222, 229), exactPeriod(265, 266)]]
];

describe("关键都城与政治中心分期口径", () => {
  it.each(CAPITAL_TRANSITIONS)("%s 在 %i 年显示 %j", (polityId, year, places) => {
    expect(activePlaces(polityId, year)).toEqual(places);
  });

  it("西秦401—408年中断期没有点位", () => {
    for (let year = 401; year <= 408; year += 1) {
      expect(activePlaces("polity-cn-western-qin", year), String(year)).toEqual([]);
    }
  });

  it.each(RETAINED_GEOGRAPHY_GAPS)("%s 的地理未知年份与采用口径一致", (polityId, periods) => {
    expect(geographyCoverage(polityId)?.unknownPeriods).toEqual(periods);
  });

  it.each(CORRECTED_PERIODS)("%s 使用有直接依据的适用年份", (snapshotId, periods) => {
    expect(snapshotById(snapshotId)?.periods).toEqual(periods);
  });

  it("按直接证据区分都城、政治中心与代表性中心", () => {
    expect(snapshotById("geo-delhi-sultanate-delhi")?.role).toBe("representative-center");
    expect(snapshotById("geo-hre-regensburg-diet")).toMatchObject({
      role: "political-center",
      positionPrecision: "regional"
    });
    expect(snapshotById("geo-abbasid-samarra")).toMatchObject({
      role: "capital",
      positionPrecision: "approximate"
    });
  });

  it("东吴武昌定位到今鄂州，而不是今武汉武昌区", () => {
    const coordinates = snapshotById("geo-eastern-wu-wuchang")?.coordinates;
    expect(coordinates?.latitude).toBeCloseTo(30.4, 2);
    expect(coordinates?.longitude).toBeCloseTo(114.88, 2);
  });
});
