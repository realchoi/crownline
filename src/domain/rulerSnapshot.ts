import { isYearInPeriods, toOrdinal } from "./chronology";
import type { CrownlineDetail, HistoricalEntity, Person, Reign, ReignVacancy } from "./types";

export type RulerSnapshotStatus = "known" | "disputed" | "vacant" | "unrecorded";

export interface RulerSnapshotEntry {
  person: Person;
  reign: Reign;
}

export interface RulerSnapshot {
  polityId: string;
  year: number;
  status: RulerSnapshotStatus;
  entries: RulerSnapshotEntry[];
  vacancy?: ReignVacancy;
}

const ROLE_ORDER: Record<Reign["role"], number> = {
  ruler: 0,
  "co-ruler": 1,
  regent: 2,
  contender: 3
};

/** 根据闭区间年份口径生成可供详情和后续政权对比复用的统治者快照。 */
export function selectRulerSnapshot(
  polity: HistoricalEntity,
  detail: CrownlineDetail,
  year: number
): RulerSnapshot {
  if (polity.entityKind !== "polity" || detail.entityId !== polity.id) {
    throw new Error(`无法为不存在的政权 ${polity.id} 生成统治者快照`);
  }

  const personById = new Map(detail.persons.map((item) => [item.id, item]));
  const entries = detail.reigns
    .filter((reign) => reign.polityId === polity.id && isYearInPeriods(year, reign.periods))
    .map((reign) => {
      const person = personById.get(reign.personId);
      if (!person) throw new Error(`任期 ${reign.id} 引用的人物 ${reign.personId} 不存在`);
      return { person, reign };
    })
    .sort((left, right) => {
      return (
        ROLE_ORDER[left.reign.role] - ROLE_ORDER[right.reign.role] ||
        toOrdinal(left.reign.periods[0]!.start.year) -
          toOrdinal(right.reign.periods[0]!.start.year) ||
        left.person.names.primary.localeCompare(right.person.names.primary, "zh-CN")
      );
    });

  if (entries.length > 0) {
    // 争位或显式争议优先于“已有资料”状态；合法共治和摄政本身不等于争议。
    const disputed = entries.some(({ reign }) => {
      return (
        reign.role === "contender" ||
        reign.chronologyStatus === "disputed" ||
        reign.confidence === "disputed"
      );
    });
    return { polityId: polity.id, year, status: disputed ? "disputed" : "known", entries };
  }

  const vacancy = detail.reignVacancies.find((record) => {
    return record.polityId === polity.id && isYearInPeriods(year, record.periods);
  });
  if (vacancy) return { polityId: polity.id, year, status: "vacant", entries, vacancy };

  // 普通任期空档只代表当前数据未校订，不能从“没有记录”推断“当时空位”。
  return { polityId: polity.id, year, status: "unrecorded", entries };
}
