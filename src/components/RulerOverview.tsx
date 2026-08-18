import { useMemo, useState } from "react";

import { formatPeriods, toOrdinal } from "../domain/chronology";
import { DETAIL_REIGN_ROLE_NAMES } from "../domain/displayLabels";
import type {
  CrownlineDetail,
  HistoricalInterval,
  Person,
  Reign,
  ReignRole,
  ReignVacancy,
  SourceRef
} from "../domain/types";

interface RulerOverviewProps {
  detail: CrownlineDetail;
}

type OverviewFilter = "all" | ReignRole | "vacancy";

type RulerOverviewItem =
  { kind: "reign"; person: Person; reign: Reign } | { kind: "vacancy"; vacancy: ReignVacancy };

const ROLE_ORDER: Record<ReignRole, number> = {
  ruler: 0,
  "co-ruler": 1,
  regent: 2,
  contender: 3
};

const FILTER_LABELS: Record<OverviewFilter, string> = {
  all: "全部",
  ruler: "在位者",
  "co-ruler": "共治者",
  regent: "摄政者",
  contender: "争位者",
  vacancy: "明确空位"
};

function firstPeriodOrdinal(periods: HistoricalInterval[]) {
  return Math.min(...periods.map((period) => toOrdinal(period.start.year)));
}

function collectEntrySources(detail: CrownlineDetail, refs: SourceRef[]) {
  const sourceById = new Map(detail.sources.map((source) => [source.id, source]));
  const uniqueRefs = refs.filter((ref, index, all) => {
    return (
      all.findIndex(
        (candidate) =>
          candidate.sourceId === ref.sourceId &&
          candidate.locator === ref.locator &&
          candidate.note === ref.note
      ) === index
    );
  });

  return uniqueRefs.flatMap((ref) => {
    const source = sourceById.get(ref.sourceId);
    return source ? [{ source, ref }] : [];
  });
}

/** 全览模式的完整统治序列；默认展示所有角色，详细资料按条目展开。 */
export function RulerOverview({ detail }: RulerOverviewProps) {
  const [activeFilter, setActiveFilter] = useState<OverviewFilter>("all");
  const items = useMemo<RulerOverviewItem[]>(() => {
    const personById = new Map(detail.persons.map((person) => [person.id, person]));
    const reignItems = detail.reigns.flatMap<RulerOverviewItem>((reign) => {
      if (reign.polityId !== detail.entityId) return [];
      const person = personById.get(reign.personId);
      return person ? [{ kind: "reign", person, reign }] : [];
    });
    const vacancyItems = detail.reignVacancies
      .filter((vacancy) => vacancy.polityId === detail.entityId)
      .map<RulerOverviewItem>((vacancy) => ({ kind: "vacancy", vacancy }));

    return [...reignItems, ...vacancyItems].sort((left, right) => {
      const leftPeriods = left.kind === "reign" ? left.reign.periods : left.vacancy.periods;
      const rightPeriods = right.kind === "reign" ? right.reign.periods : right.vacancy.periods;
      const chronology = firstPeriodOrdinal(leftPeriods) - firstPeriodOrdinal(rightPeriods);
      if (chronology !== 0) return chronology;
      if (left.kind !== right.kind) return left.kind === "reign" ? -1 : 1;
      if (left.kind === "vacancy" || right.kind === "vacancy") return 0;
      return (
        ROLE_ORDER[left.reign.role] - ROLE_ORDER[right.reign.role] ||
        left.person.names.primary.localeCompare(right.person.names.primary, "zh-CN")
      );
    });
  }, [detail]);

  const counts = useMemo(() => {
    const result: Record<Exclude<OverviewFilter, "all">, number> = {
      ruler: 0,
      "co-ruler": 0,
      regent: 0,
      contender: 0,
      vacancy: 0
    };
    items.forEach((item) => {
      if (item.kind === "vacancy") result.vacancy += 1;
      else result[item.reign.role] += 1;
    });
    return result;
  }, [items]);

  const availableFilters = (Object.keys(FILTER_LABELS) as OverviewFilter[]).filter((filter) => {
    return filter === "all" || counts[filter] > 0;
  });
  const visibleItems = items.filter((item) => {
    if (activeFilter === "all") return true;
    return item.kind === "vacancy" ? activeFilter === "vacancy" : activeFilter === item.reign.role;
  });
  const reignCount = items.filter((item) => item.kind === "reign").length;
  const vacancyCount = counts.vacancy;

  return (
    <section className="detail-section ruler-overview" aria-labelledby="ruler-overview-title">
      <div className="detail-section-heading ruler-overview-heading">
        <div>
          <h3 id="ruler-overview-title">统治序列</h3>
          <p>
            收录 {reignCount} 条任期记录
            {vacancyCount > 0 ? `、${vacancyCount} 段明确空位` : ""}，按任期起点排列。
          </p>
        </div>
        <span className="ruler-overview-total" aria-hidden="true">
          {items.length}
        </span>
      </div>

      <div className="ruler-filter-list" role="group" aria-label="按统治角色筛选">
        {availableFilters.map((filter) => (
          <button
            aria-pressed={activeFilter === filter}
            className="ruler-filter"
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
          >
            <span>{FILTER_LABELS[filter]}</span>
            <strong>{filter === "all" ? items.length : counts[filter]}</strong>
          </button>
        ))}
      </div>

      <div className="ruler-sequence">
        {visibleItems.map((item) => {
          if (item.kind === "vacancy") {
            const entrySources = collectEntrySources(detail, item.vacancy.sourceRefs);
            return (
              <details className="ruler-sequence-item vacancy-sequence-item" key={item.vacancy.id}>
                <summary>
                  <span className="sequence-period">{formatPeriods(item.vacancy.periods)}</span>
                  <strong className="sequence-name">明确空位</strong>
                  <span className="role-badge role-vacancy">空位</span>
                  <span className="sequence-disclosure" aria-hidden="true" />
                </summary>
                <div className="sequence-detail">
                  <p>{item.vacancy.note}</p>
                  {item.vacancy.confidenceNote && <p>{item.vacancy.confidenceNote}</p>}
                  <EntrySources sources={entrySources} />
                </div>
              </details>
            );
          }

          const { person, reign } = item;
          const entrySources = collectEntrySources(detail, [
            ...person.sourceRefs,
            ...reign.sourceRefs
          ]);
          return (
            <details className="ruler-sequence-item" key={reign.id}>
              <summary>
                <span className="sequence-period">{formatPeriods(reign.periods)}</span>
                <strong className="sequence-name">{person.names.primary}</strong>
                <span className={`role-badge role-${reign.role}`}>
                  {DETAIL_REIGN_ROLE_NAMES[reign.role]}
                </span>
                <span className="sequence-disclosure" aria-hidden="true" />
              </summary>
              <div className="sequence-detail">
                {person.names.aliases.length > 0 && (
                  <p className="ruler-aliases">又名：{person.names.aliases.join("、")}</p>
                )}
                {(reign.titles.length > 0 || reign.localTitles?.length) && (
                  <p className="ruler-titles">
                    称号：{[...reign.titles, ...(reign.localTitles ?? [])].join("、")}
                  </p>
                )}
                <p>{person.description}</p>
                {reign.note && <p className="ruler-note">{reign.note}</p>}
                {reign.confidenceNote && reign.confidenceNote !== reign.note && (
                  <p className="confidence-note">{reign.confidenceNote}</p>
                )}
                <EntrySources sources={entrySources} />
              </div>
            </details>
          );
        })}
      </div>
      <p className="ruler-overview-hint">展开任一条目，可查看人物说明、称号与资料来源。</p>
    </section>
  );
}

interface EntrySourcesProps {
  sources: ReturnType<typeof collectEntrySources>;
}

function EntrySources({ sources }: EntrySourcesProps) {
  if (sources.length === 0) return null;
  return (
    <div className="sequence-sources">
      <span>来源</span>
      <ul>
        {sources.map(({ source, ref }, index) => (
          <li key={`${source.id}-${ref.locator ?? ""}-${index}`}>
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            ) : (
              source.title
            )}
            {ref.locator && <small>{ref.locator}</small>}
            {ref.note && <small>{ref.note}</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}
