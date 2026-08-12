import { calculatePeriodsDuration, toOrdinal } from "./chronology";
import type {
  CrownlineDetail,
  DatePrecision,
  HistoricalDate,
  HistoricalEntity,
  HistoricalInterval,
  Person,
  Reign
} from "./types";

const PRECISION_ORDER: Record<DatePrecision, number> = {
  exact: 0,
  circa: 1,
  decade: 2,
  century: 3,
  unknown: 4
};

const ROLE_ORDER: Record<Reign["role"], number> = {
  ruler: 0,
  "co-ruler": 1,
  regent: 2,
  contender: 3
};

export interface PolityComparison {
  left: HistoricalEntity;
  right: HistoricalEntity;
  overlapPeriods: HistoricalInterval[];
  overlapYears: number;
}

export interface ComparisonRulerEntry {
  person: Person;
  reign: Reign;
  periods: HistoricalInterval[];
}

function conservativeDate(left: HistoricalDate, right: HistoricalDate): HistoricalDate {
  if (left.year !== right.year) return left;
  return PRECISION_ORDER[left.precision] >= PRECISION_ORDER[right.precision] ? left : right;
}

/** 对两组闭区间做集合求交，并保留决定交集边界的年代精度。 */
export function intersectHistoricalPeriods(
  leftPeriods: HistoricalInterval[],
  rightPeriods: HistoricalInterval[]
): HistoricalInterval[] {
  return leftPeriods.flatMap((left) => {
    return rightPeriods.flatMap((right) => {
      const leftStart = toOrdinal(left.start.year);
      const rightStart = toOrdinal(right.start.year);
      const leftEnd = toOrdinal(left.end.year);
      const rightEnd = toOrdinal(right.end.year);
      const startOrdinal = Math.max(leftStart, rightStart);
      const endOrdinal = Math.min(leftEnd, rightEnd);
      if (startOrdinal > endOrdinal) return [];

      const start = leftStart > rightStart
        ? left.start
        : rightStart > leftStart
          ? right.start
          : conservativeDate(left.start, right.start);
      const end = leftEnd < rightEnd
        ? left.end
        : rightEnd < leftEnd
          ? right.end
          : conservativeDate(left.end, right.end);
      return [{ start, end }];
    });
  }).sort((left, right) => {
    return toOrdinal(left.start.year) - toOrdinal(right.start.year) ||
      toOrdinal(left.end.year) - toOrdinal(right.end.year);
  });
}

/** 生成双方基本时间关系；历史关系数据由阶段 4B 单独处理。 */
export function buildPolityComparison(
  left: HistoricalEntity,
  right: HistoricalEntity
): PolityComparison {
  if (left.entityKind !== "polity" || right.entityKind !== "polity") {
    throw new Error("只有真实政权可以进行时间对比");
  }
  const overlapPeriods = intersectHistoricalPeriods(
    left.existencePeriods,
    right.existencePeriods
  );
  return {
    left,
    right,
    overlapPeriods,
    overlapYears: calculatePeriodsDuration(overlapPeriods)
  };
}

/** 返回任期与共同存在区间相交的人物，并把展示区间裁剪到共同期内。 */
export function selectRulersDuringPeriods(
  polity: HistoricalEntity,
  detail: CrownlineDetail,
  periods: HistoricalInterval[]
): ComparisonRulerEntry[] {
  if (polity.entityKind !== "polity" || detail.entityId !== polity.id) {
    throw new Error(`详情与政权 ${polity.id} 不匹配`);
  }
  const personById = new Map(detail.persons.map((person) => [person.id, person]));

  return detail.reigns.flatMap((reign) => {
    if (reign.polityId !== polity.id) return [];
    const overlappingPeriods = intersectHistoricalPeriods(reign.periods, periods);
    if (overlappingPeriods.length === 0) return [];
    const person = personById.get(reign.personId);
    if (!person) throw new Error(`任期 ${reign.id} 引用的人物 ${reign.personId} 不存在`);
    return [{ person, reign, periods: overlappingPeriods }];
  }).sort((left, right) => {
    return toOrdinal(left.periods[0]!.start.year) - toOrdinal(right.periods[0]!.start.year) ||
      ROLE_ORDER[left.reign.role] - ROLE_ORDER[right.reign.role] ||
      left.person.names.primary.localeCompare(right.person.names.primary, "zh-CN");
  });
}
