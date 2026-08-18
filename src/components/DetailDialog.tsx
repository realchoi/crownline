import { useEffect, useRef } from "react";

import {
  calculatePeriodsDuration,
  formatHistoricalYear,
  formatPeriods
} from "../domain/chronology";
import {
  DETAIL_CONFIDENCE_NAMES,
  DETAIL_POLITY_FORM_NAMES,
  DETAIL_REIGN_ROLE_NAMES,
  DISPLAY_CATEGORY_NAMES
} from "../domain/displayLabels";
import { selectRulerSnapshot, type RulerSnapshot } from "../domain/rulerSnapshot";
import type { CrownlineDetail, HistoricalEntity, Region, SourceRef } from "../domain/types";
import { DetailLoadPanel, type DetailLoadState } from "./DetailLoadPanel";
import { EntityLocalName } from "./EntityLocalName";

interface DetailDialogProps {
  entity: HistoricalEntity;
  sectionTitle: string | undefined;
  regions: Region[];
  detailState: DetailLoadState;
  currentYear?: number;
  onRetry: () => void;
  onClose: () => void;
}

/** 收集实体、人物和任期来源；同一来源只展示一次，同时保留页码等定位信息。 */
function collectSourceGroups(
  detail: CrownlineDetail,
  entity: HistoricalEntity,
  snapshot: RulerSnapshot | undefined
) {
  const refsBySourceId = new Map<string, SourceRef[]>();
  const addRefs = (refs: SourceRef[]) => {
    refs.forEach((ref) => {
      const existing = refsBySourceId.get(ref.sourceId) ?? [];
      const duplicate = existing.some(
        (item) => item.locator === ref.locator && item.note === ref.note
      );
      if (!duplicate) refsBySourceId.set(ref.sourceId, [...existing, ref]);
    });
  };

  addRefs(entity.sourceRefs);
  entity.alternativeChronologies?.forEach((chronology) => addRefs(chronology.sourceRefs));
  snapshot?.entries.forEach(({ person, reign }) => {
    addRefs(person.sourceRefs);
    addRefs(reign.sourceRefs);
  });
  if (snapshot?.vacancy) addRefs(snapshot.vacancy.sourceRefs);

  const sourceById = new Map(detail.sources.map((source) => [source.id, source]));
  return Array.from(refsBySourceId, ([sourceId, refs]) => ({
    source: sourceById.get(sourceId),
    refs
  })).filter((group): group is { source: NonNullable<typeof group.source>; refs: SourceRef[] } => {
    return group.source !== undefined;
  });
}

/** 渲染实体完整元数据，并在时间点模式展示当年统治者快照。 */
export function DetailDialog({
  entity,
  sectionTitle,
  regions,
  detailState,
  currentYear,
  onRetry,
  onClose
}: DetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const duration = calculatePeriodsDuration(entity.existencePeriods);
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const regionNames = entity.historicalRegionIds.flatMap((regionId) => {
    const region = regionById.get(regionId);
    return region ? [region.names.primary] : [];
  });
  const detail = detailState.status === "ready" ? detailState.detail : undefined;
  const snapshot =
    detail && entity.entityKind === "polity" && currentYear !== undefined
      ? selectRulerSnapshot(entity, detail, currentYear)
      : undefined;
  const sourceGroups = detail ? collectSourceGroups(detail, entity, snapshot) : [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // 浏览器使用原生模态能力；测试环境不支持时退化为 open 属性。
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    closeButtonRef.current?.focus();

    const dialogBody = dialog.querySelector(".dialog-body");
    const handleWheel = (event: WheelEvent) => {
      if (!(dialogBody instanceof HTMLElement)) {
        event.preventDefault();
        return;
      }

      const target = event.target;
      if (!(target instanceof Node) || !dialogBody.contains(target)) {
        event.preventDefault();
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = dialogBody;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
        event.preventDefault();
      }
    };

    dialog.addEventListener("wheel", handleWheel, { passive: false });
    // 显式监听 Escape，确保不同浏览器和自动化环境都走统一关闭流程。
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("wheel", handleWheel);
      document.removeEventListener("keydown", handleKeyDown);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [onClose]);

  const rulerHeading =
    currentYear === undefined
      ? undefined
      : `${formatHistoricalYear({ year: currentYear, precision: "exact" })}年 · 在位统治者`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="detail-name"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => event.currentTarget === event.target && onClose()}
    >
      <div className="dialog-shell">
        <div className="dialog-head">
          <div>
            <span className={`type-badge detail-${entity.displayCategory}`}>
              {DISPLAY_CATEGORY_NAMES[entity.displayCategory]}
            </span>
            <h2 className="dialog-title" id="detail-name">
              {entity.names.primary}
            </h2>
            <EntityLocalName names={entity.names} />
            <p className="dialog-years">
              {formatPeriods(entity.existencePeriods, entity.displayRangeOverride)}
            </p>
          </div>
          <button
            className="icon-button"
            ref={closeButtonRef}
            type="button"
            aria-label="关闭详情"
            onClick={onClose}
          />
        </div>

        <div className="dialog-body">
          <p className="detail-summary">{entity.description}</p>
          {entity.chronologyNote && (
            <p className="chronology-note">采用口径：{entity.chronologyNote}</p>
          )}
          {entity.confidenceNote && <p className="confidence-note">{entity.confidenceNote}</p>}

          <dl className="detail-grid">
            {sectionTitle && (
              <div className="detail-card">
                <dt>阶段</dt>
                <dd>{sectionTitle}</dd>
              </div>
            )}
            <div className="detail-card">
              <dt>历史地区</dt>
              <dd>{regionNames.join("、") || "尚未标注"}</dd>
            </div>
            {entity.entityKind === "polity" && (
              <div className="detail-card">
                <dt>政权形态</dt>
                <dd>
                  {entity.polityForms.map((form) => DETAIL_POLITY_FORM_NAMES[form]).join("、")}
                </dd>
              </div>
            )}
            <div className="detail-card">
              <dt>持续时间</dt>
              <dd>{duration > 1 ? `约 ${duration} 年` : "不足 1 年"}</dd>
            </div>
            <div className="detail-card">
              <dt>资料可信度</dt>
              <dd>{DETAIL_CONFIDENCE_NAMES[entity.confidence]}</dd>
            </div>
          </dl>

          {entity.alternativeChronologies && entity.alternativeChronologies.length > 0 && (
            <section className="detail-section" aria-labelledby="alternative-chronology-title">
              <h3 id="alternative-chronology-title">其他年代口径</h3>
              <ul className="alternative-list">
                {entity.alternativeChronologies.map((chronology) => (
                  <li key={chronology.label}>
                    <strong>{chronology.label}</strong>
                    <span>{formatPeriods(chronology.existencePeriods)}</span>
                    <p>{chronology.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <DetailLoadPanel state={detailState} onRetry={onRetry} />

          {detail && entity.entityKind === "polity" && currentYear === undefined && (
            <section
              className="detail-section ruler-overview"
              aria-labelledby="ruler-overview-title"
            >
              <h3 id="ruler-overview-title">统治者资料</h3>
              <p>切换到时间点模式，可查看指定年份的在位统治者、摄政者和争位者。</p>
            </section>
          )}

          {snapshot && (
            <section className="detail-section ruler-panel" aria-labelledby="ruler-snapshot-title">
              <div className="detail-section-heading">
                <h3 id="ruler-snapshot-title">{rulerHeading}</h3>
                {snapshot.status === "disputed" && (
                  <span className="ruler-status disputed">存在争议</span>
                )}
              </div>

              {(snapshot.status === "known" || snapshot.status === "disputed") && (
                <div className="ruler-list">
                  {snapshot.entries.map(({ person, reign }) => (
                    <article className="ruler-card" key={reign.id}>
                      <div className="ruler-card-heading">
                        <h4>{person.names.primary}</h4>
                        <span className={`role-badge role-${reign.role}`}>
                          {DETAIL_REIGN_ROLE_NAMES[reign.role]}
                        </span>
                      </div>
                      {person.names.aliases.length > 0 && (
                        <p className="ruler-aliases">又名：{person.names.aliases.join("、")}</p>
                      )}
                      <p className="ruler-period">{formatPeriods(reign.periods)}</p>
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
                    </article>
                  ))}
                </div>
              )}

              {snapshot.status === "vacant" && snapshot.vacancy && (
                <div className="ruler-empty explicit-vacancy">
                  <strong>已有资料记为空位期</strong>
                  <p>{snapshot.vacancy.note}</p>
                  {snapshot.vacancy.confidenceNote && <p>{snapshot.vacancy.confidenceNote}</p>}
                </div>
              )}

              {snapshot.status === "unrecorded" && (
                <div className="ruler-empty">
                  <strong>这一年的统治者资料尚未校订</strong>
                  <p>这表示当前数据集尚无可展示记录，不等于当时无人统治。</p>
                </div>
              )}
            </section>
          )}

          {sourceGroups.length > 0 && (
            <section
              className="detail-section source-section"
              aria-labelledby="detail-sources-title"
            >
              <h3 id="detail-sources-title">资料来源</h3>
              <ol className="source-list">
                {sourceGroups.map(({ source, refs }) => (
                  <li key={source.id}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.citation}
                      </a>
                    ) : (
                      <span>{source.citation}</span>
                    )}
                    {refs.some((ref) => ref.locator || ref.note) && (
                      <small>
                        {refs
                          .flatMap((ref) => [ref.locator, ref.note])
                          .filter(Boolean)
                          .join("；")}
                      </small>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </dialog>
  );
}
