import { formatHistoricalYear, formatPeriods } from "../domain/chronology";
import type { MatchedEntity } from "../domain/selectors";
import type { RegionScope } from "../domain/regionScope";
import type { Region } from "../domain/types";
import { DISPLAY_CATEGORY_NAMES } from "./FilterPanel";

interface TimepointViewProps {
  year: number;
  polities: MatchedEntity[];
  historicalPeriods: MatchedEntity[];
  regions: Region[];
  regionScope: RegionScope;
  polityEmptyReason: "unindexed" | "limited-coverage" | "filtered-out" | null;
  onSelect: (entityId: string, trigger: HTMLButtonElement) => void;
}

function TimepointCard({
  match,
  onSelect,
  regions
}: {
  match: MatchedEntity;
  onSelect: TimepointViewProps["onSelect"];
  regions: Region[];
}) {
  const { entity, section } = match;
  const regionNames = entity.historicalRegionIds.flatMap((regionId) => {
    const region = regions.find(({ id }) => id === regionId);
    return region ? [region.names.primary] : [];
  });
  const periods = formatPeriods(entity.existencePeriods, entity.displayRangeOverride);
  const isApproximate = entity.existencePeriods.some((period) => {
    return period.start.precision !== "exact" || period.end.precision !== "exact";
  });

  return (
    <button
      className={`timepoint-card timepoint-${entity.displayCategory}`}
      type="button"
      aria-label={`${entity.names.primary}，${periods}，${DISPLAY_CATEGORY_NAMES[entity.displayCategory]}。点击查看详情。`}
      onClick={(event) => onSelect(entity.id, event.currentTarget)}
    >
      <span className="timepoint-card-topline">
        <span className={`type-badge detail-${entity.displayCategory}`}>
          {DISPLAY_CATEGORY_NAMES[entity.displayCategory]}
        </span>
        <span className="timepoint-card-section">{section?.title ?? regionNames.join(" · ")}</span>
      </span>
      <strong className="timepoint-card-name">{entity.names.primary}</strong>
      <span className="timepoint-card-periods">{periods}</span>
      <span className="timepoint-card-regions">{regionNames.join(" · ")}</span>
      {(isApproximate || entity.chronologyStatus === "disputed") && (
        <span className="timepoint-card-flags">
          {isApproximate && <span>年代约略</span>}
          {entity.chronologyStatus === "disputed" && <span>年代有争议</span>}
        </span>
      )}
    </button>
  );
}

/** 按指定年份分开呈现真实政权与历史分期背景。 */
export function TimepointView({
  year,
  polities,
  historicalPeriods,
  regions,
  regionScope,
  polityEmptyReason,
  onSelect
}: TimepointViewProps) {
  const formattedYear = formatHistoricalYear({ year, precision: "exact" });
  const scopeRegions = regionScope.mode === "custom"
    ? regions.filter(({ id }) => regionScope.regionIds.includes(id))
    : [];
  const scopeName = regionScope.mode === "china"
    ? "中国历史范围"
    : regionScope.mode === "global"
      ? "全球已收录范围"
      : scopeRegions.map(({ names }) => names.primary).join("、");
  const allMatches = [...polities, ...historicalPeriods];
  const hasApproximateChronology = allMatches.some(({ entity }) => {
    return entity.existencePeriods.some((period) => {
      return period.start.precision !== "exact" || period.end.precision !== "exact";
    });
  });
  const hasDisputedChronology = allMatches.some(({ entity }) => {
    return entity.chronologyStatus === "disputed";
  });
  const isBoundaryYear = allMatches.some(({ entity }) => {
    return entity.existencePeriods.some((period) => {
      return period.start.year === year || period.end.year === year;
    });
  });

  return (
    <section
      className="timepoint-view"
      aria-label={`${formattedYear} 年时间点结果`}
    >
      <header className="timepoint-heading">
        <p className="timepoint-kicker">历史切片</p>
        <h2>{formattedYear}年 · 当时存在</h2>
        <p>依据当前收录数据与“年份内任一时刻存在”的统一口径。</p>
      </header>

      {(hasApproximateChronology || hasDisputedChronology || isBoundaryYear) && (
        <aside className="timepoint-notices" aria-label="年代提示">
          {hasApproximateChronology && <p>部分条目的起止年份采用约略年代，筛选按页面所示区间计算。</p>}
          {hasDisputedChronology && <p>部分条目的年代口径存在争议，请打开条目查看说明。</p>}
          {isBoundaryYear && <p>当前年份是部分条目的起止边界；按整年存在规则计入结果。</p>}
        </aside>
      )}

      <section className="timepoint-section" aria-label="当时存在的政权">
        <div className="timepoint-section-heading">
          <h3>当时存在的政权</h3>
          <span>{polities.length} 个</span>
        </div>
        {polities.length > 0 ? (
          <div className="timepoint-grid">
            {polities.map((match) => (
              <TimepointCard key={match.entity.id} match={match} onSelect={onSelect} regions={regions} />
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            {polityEmptyReason === "unindexed" && (
              <>{scopeName}尚未收录代表性政权；这不表示该地区在历史上没有政权。</>
            )}
            {polityEmptyReason === "limited-coverage" && (
              <>{formattedYear}年在{scopeName}暂无已收录政权；当前数据覆盖有限，不表示当时不存在政权。</>
            )}
            {polityEmptyReason === "filtered-out" && (
              <>{formattedYear}年没有匹配当前搜索与类别的政权。<br />可尝试清除筛选或选择其他年份。</>
            )}
          </div>
        )}
      </section>

      <section className="timepoint-section historical-context" aria-label="历史背景">
        <div className="timepoint-section-heading">
          <div>
            <p className="timepoint-kicker">不计入政权结果</p>
            <h3>历史背景</h3>
          </div>
          <span>{historicalPeriods.length} 条</span>
        </div>
        {historicalPeriods.length > 0 ? (
          <div className="timepoint-grid context-grid">
            {historicalPeriods.map((match) => (
              <TimepointCard key={match.entity.id} match={match} onSelect={onSelect} regions={regions} />
            ))}
          </div>
        ) : (
          <p className="context-empty">该年份暂无单独收录的历史分期背景。</p>
        )}
      </section>
    </section>
  );
}
