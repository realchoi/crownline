import { useEffect, useMemo, useState } from "react";

import type { CrownlineDetailLoader } from "../data/loadCrownlineDetail";
import { formatHistoricalYear, formatPeriods, isYearInPeriods } from "../domain/chronology";
import {
  buildPolityComparison,
  selectRulersDuringPeriods,
  type ComparisonRulerEntry
} from "../domain/polityComparison";
import { selectRulerSnapshot, type RulerSnapshot } from "../domain/rulerSnapshot";
import type {
  CrownlineDetail,
  HistoricalEntity,
  PolityForm,
  Region,
  ReignRole
} from "../domain/types";

const POLITY_FORM_NAMES: Record<PolityForm, string> = {
  dynasty: "王朝",
  empire: "帝国",
  kingdom: "王国",
  khanate: "汗国",
  state: "国家",
  other: "其他"
};

const REIGN_ROLE_NAMES: Record<ReignRole, string> = {
  ruler: "统治者",
  "co-ruler": "共治者",
  regent: "摄政者",
  contender: "争位者"
};

type ComparisonDetailState =
  | { status: "idle" | "loading" }
  | { status: "ready"; entityIds: [string, string]; details: [CrownlineDetail, CrownlineDetail] }
  | { status: "error"; message: string };

interface ComparisonPanelProps {
  entities: HistoricalEntity[];
  regions: Region[];
  currentYear?: number;
  loadDetail: CrownlineDetailLoader;
  onRemove: (entityId: string) => void;
  onClear: () => void;
}

function CurrentYearStatus({ snapshot, year }: { snapshot: RulerSnapshot; year: number }) {
  const formattedYear = formatHistoricalYear({ year, precision: "exact" });
  if (snapshot.status === "vacant") return <p>{formattedYear}年已有资料记为空位期。</p>;
  if (snapshot.status === "unrecorded") return <p>{formattedYear}年的统治者资料尚未校订。</p>;
  return (
    <p>
      {formattedYear}年命中下方 {snapshot.entries.length} 位
      {snapshot.status === "disputed" ? "有争议的" : "已收录"}人物。
    </p>
  );
}

function ComparisonRulerList({
  entries,
  snapshot,
  currentYear
}: {
  entries: ComparisonRulerEntry[];
  snapshot?: RulerSnapshot;
  currentYear?: number;
}) {
  const currentReignIds = new Set(snapshot?.entries.map(({ reign }) => reign.id) ?? []);
  return (
    <details className="comparison-rulers" open>
      <summary>共同存续期内已收录统治者 · {entries.length} 位</summary>
      {entries.length > 0 ? (
        <ul>
          {entries.map(({ person, reign, periods }) => (
            <li className={currentReignIds.has(reign.id) ? "is-current" : ""} key={reign.id}>
              <span>
                <strong>{person.names.primary}</strong>
                <small>{REIGN_ROLE_NAMES[reign.role]}</small>
              </span>
              <span>
                {formatPeriods(periods)}
                {currentReignIds.has(reign.id) && currentYear !== undefined && (
                  <em>{formatHistoricalYear({ year: currentYear, precision: "exact" })}年在位</em>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>共同存续期内暂无已校订的统治者资料。</p>
      )}
    </details>
  );
}

function PolityColumn({
  entity,
  regions,
  detail,
  overlapPeriods,
  currentYear
}: {
  entity: HistoricalEntity;
  regions: Region[];
  detail?: CrownlineDetail;
  overlapPeriods: ReturnType<typeof buildPolityComparison>["overlapPeriods"];
  currentYear?: number;
}) {
  const regionNames = entity.historicalRegionIds.flatMap((regionId) => {
    const region = regions.find(({ id }) => id === regionId);
    return region ? [region.names.primary] : [];
  });
  const entries = detail ? selectRulersDuringPeriods(entity, detail, overlapPeriods) : [];
  const snapshot = detail && currentYear
    ? selectRulerSnapshot(entity, detail, currentYear)
    : undefined;

  return (
    <article className="comparison-column">
      <header>
        <p>对比政权</p>
        <h3>{entity.names.primary}</h3>
        <span>{formatPeriods(entity.existencePeriods, entity.displayRangeOverride)}</span>
      </header>
      <dl>
        <div><dt>政权形态</dt><dd>{entity.polityForms.map((form) => POLITY_FORM_NAMES[form]).join("、")}</dd></div>
        <div><dt>历史地区</dt><dd>{regionNames.join("、") || "尚未标注"}</dd></div>
        <div><dt>年代口径</dt><dd>{entity.chronologyStatus === "disputed" ? "存在争议" : "当前采用"}</dd></div>
      </dl>
      {snapshot && currentYear && (
        <div className="comparison-current-ruler">
          <strong>{formatHistoricalYear({ year: currentYear, precision: "exact" })}年统治者</strong>
          <CurrentYearStatus snapshot={snapshot} year={currentYear} />
        </div>
      )}
      {detail && (
        <ComparisonRulerList
          entries={entries}
          {...(snapshot ? { snapshot } : {})}
          {...(currentYear !== undefined ? { currentYear } : {})}
        />
      )}
    </article>
  );
}

/** 双政权选择槽、时间交集和共同期统治者的组合面板。 */
export function ComparisonPanel({
  entities,
  regions,
  currentYear,
  loadDetail,
  onRemove,
  onClear
}: ComparisonPanelProps) {
  const [retrySequence, setRetrySequence] = useState(0);
  const [detailState, setDetailState] = useState<ComparisonDetailState>({ status: "idle" });
  const comparison = useMemo(() => {
    return entities.length === 2 ? buildPolityComparison(entities[0]!, entities[1]!) : null;
  }, [entities]);
  const entityKey = entities.map(({ id }) => id).join("|");

  useEffect(() => {
    if (entities.length !== 2) return;
    let active = true;
    const [left, right] = entities as [HistoricalEntity, HistoricalEntity];
    const loadComparisonDetail = async (entity: HistoricalEntity) => {
      try {
        const detail = await loadDetail(entity.id);
        if (!detail) throw new Error("详情缺失");
        return detail;
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`无法加载${entity.names.primary}的对比详情：${reason}`);
      }
    };
    setDetailState({ status: "loading" });
    void Promise.all([loadComparisonDetail(left), loadComparisonDetail(right)]).then(([
      leftDetail,
      rightDetail
    ]) => {
      if (active) {
        setDetailState({
          status: "ready",
          entityIds: [left.id, right.id],
          details: [leftDetail, rightDetail]
        });
      }
    }).catch((error: unknown) => {
      if (active) {
        setDetailState({
          status: "error",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });
    return () => { active = false; };
  }, [entities, entityKey, loadDetail, retrySequence]);

  const readyDetails = detailState.status === "ready" &&
    detailState.entityIds.join("|") === entityKey
    ? detailState.details
    : undefined;
  const currentYearOverlaps = comparison && currentYear
    ? isYearInPeriods(currentYear, comparison.overlapPeriods)
    : false;
  const comparisonYear = currentYearOverlaps ? currentYear : undefined;

  return (
    <section className="comparison-panel" aria-labelledby="comparison-title">
      <div className="comparison-panel-heading">
        <div>
          <p className="comparison-kicker">阶段 4A · 时间关系</p>
          <h2 id="comparison-title">政权时间对比</h2>
        </div>
        <button className="comparison-clear" type="button" onClick={onClear}>清空对比</button>
      </div>

      <div className="comparison-slots" role="group" aria-label="已选对比政权">
        {[0, 1].map((index) => {
          const entity = entities[index];
          return entity ? (
            <div className="comparison-slot is-filled" key={entity.id}>
              <span>{index === 0 ? "A" : "B"}</span>
              <strong>{entity.names.primary}</strong>
              <button
                type="button"
                aria-label={`从对比中移除${entity.names.primary}`}
                onClick={() => onRemove(entity.id)}
              >
                移除
              </button>
            </div>
          ) : (
            <div className="comparison-slot" key={index}>
              <span>B</span>
              <strong>再选择一个政权</strong>
              <small>可先搜索或切换地区，再点击“+ 对比”</small>
            </div>
          );
        })}
      </div>

      {comparison && (
        <>
          <div className={`comparison-summary${currentYearOverlaps ? " is-current" : ""}`}>
            {comparison.overlapPeriods.length > 0 ? (
              <>
                <p>共同存在区间</p>
                <strong>{formatPeriods(comparison.overlapPeriods)}</strong>
                <span>共同存续 {comparison.overlapYears} 年</span>
                {currentYearOverlaps && currentYear && (
                  <em>{formatHistoricalYear({ year: currentYear, precision: "exact" })}年位于共同存续期</em>
                )}
              </>
            ) : (
              <>
                <p>时间关系</p>
                <strong>存续时间没有重叠</strong>
                <span>这不表示双方没有历史关系；关系数据将在阶段 4B 单独校订。</span>
              </>
            )}
          </div>

          <div className="comparison-columns">
            <PolityColumn
              entity={comparison.left}
              regions={regions}
              overlapPeriods={comparison.overlapPeriods}
              {...(readyDetails?.[0] ? { detail: readyDetails[0] } : {})}
              {...(comparisonYear !== undefined ? { currentYear: comparisonYear } : {})}
            />
            <PolityColumn
              entity={comparison.right}
              regions={regions}
              overlapPeriods={comparison.overlapPeriods}
              {...(readyDetails?.[1] ? { detail: readyDetails[1] } : {})}
              {...(comparisonYear !== undefined ? { currentYear: comparisonYear } : {})}
            />
          </div>

          {!readyDetails && detailState.status === "loading" && (
            <p className="comparison-load-state" role="status">正在加载双方统治者详情…</p>
          )}
          {detailState.status === "error" && (
            <div className="comparison-load-state is-error" role="alert">
              <p>{detailState.message}</p>
              <button type="button" onClick={() => setRetrySequence((value) => value + 1)}>
                重新加载对比详情
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
