import { useCallback, useEffect, useMemo, useRef } from "react";

import { DetailDialog } from "../components/DetailDialog";
import { ComparisonPanel } from "../components/ComparisonPanel";
import { getHistoricalYearBounds } from "../domain/browseState";
import { selectBoundarySnapshots, type BoundarySelection } from "../domain/boundarySnapshots";
import { buildOverviewTimelineGroups } from "../domain/overviewTimeline";
import { selectMapSnapshots } from "../domain/mapSnapshots";
import { selectBrowseResults } from "../domain/selectors";
import type { CrownlineIndex, TimelineSection } from "../domain/types";
import type { CrownlineDetailLoader } from "../data/loadCrownlineDetail";
import type { CrownlineGeographyLoader } from "../data/loadCrownlineGeography";
import type { CrownlineBoundariesLoader } from "../data/loadCrownlineBoundaries";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { BrowseContent } from "./BrowseContent";
import { BrowseControls } from "./BrowseControls";
import { BrowseResultsSummary } from "./BrowseResultsSummary";
import { BrowseScopeNote } from "./BrowseScopeNote";
import { useBrowseUrlState } from "./useBrowseUrlState";
import { useEntityDetail } from "./useEntityDetail";
import { useGeographyData } from "./useGeographyData";
import { useBoundaryData } from "./useBoundaryData";

/** 应用根组件接收的已校验数据。 */
interface AppProps {
  data: CrownlineIndex;
  loadDetail: CrownlineDetailLoader;
  loadGeography: CrownlineGeographyLoader;
  loadBoundaries: CrownlineBoundariesLoader;
}

/** 组合筛选状态、时间轴、详情弹窗和 URL 同步的应用根组件。 */
export function App({ data, loadDetail, loadGeography, loadBoundaries }: AppProps) {
  const yearBounds = useMemo(() => getHistoricalYearBounds(data), [data]);
  const { browseState, setBrowseState } = useBrowseUrlState({
    yearBounds,
    regions: data.regions,
    entities: data.entities
  });
  const { detailState, retry: retryDetail } = useEntityDetail(
    browseState.detailEntityId,
    data.detailEntityIds,
    loadDetail
  );
  const { geographyState, retry: retryGeography } = useGeographyData(
    browseState.viewMode,
    loadGeography
  );
  const { boundaryState, retry: retryBoundaries } = useBoundaryData(
    browseState.viewMode,
    browseState.mapLayer,
    loadBoundaries
  );
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const comparisonRef = useRef<HTMLElement>(null);
  const focusComparisonRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const results = useMemo(() => {
    const filters = {
      query: browseState.query,
      category: browseState.category,
      regionScope: browseState.regionScope
    };
    return browseState.timeRange === "year"
      ? selectBrowseResults(data, { ...filters, year: browseState.year })
      : selectBrowseResults(data, filters);
  }, [browseState, data]);
  const allMatches = useMemo(() => {
    const sectionByEntityId = new Map<string, TimelineSection>();
    data.timelineSections.forEach((section) => {
      section.entityIds.forEach((entityId) => sectionByEntityId.set(entityId, section));
    });
    return data.entities.map((entity) => ({ entity, section: sectionByEntityId.get(entity.id) }));
  }, [data]);
  const mapSelection = useMemo(() => {
    if (geographyState.status !== "ready") return null;
    return selectMapSnapshots(
      results.polities.map(({ entity }) => entity),
      geographyState.result.geography.geographicSnapshots,
      browseState.timeRange === "year" ? browseState.year : undefined
    );
  }, [browseState.timeRange, browseState.year, geographyState, results.polities]);
  const boundarySelection = useMemo<BoundarySelection | null>(() => {
    if (boundaryState.status !== "ready") return null;
    return selectBoundarySnapshots(
      results.polities.map(({ entity }) => entity),
      boundaryState.result.boundaries.boundarySnapshots,
      browseState.timeRange === "year" ? browseState.year : undefined
    );
  }, [boundaryState, browseState.timeRange, browseState.year, results.polities]);
  // 即使筛选状态变化，也要允许已打开的详情继续读取完整实体记录。
  const selectedMatch = browseState.detailEntityId
    ? allMatches.find(({ entity }) => entity.id === browseState.detailEntityId)
    : undefined;
  const overviewGroups = useMemo(() => {
    return buildOverviewTimelineGroups(data, results.all, browseState.regionScope);
  }, [browseState.regionScope, data, results.all]);
  const overviewTotal = useMemo(() => {
    return selectBrowseResults(data, {
      query: "",
      category: "all",
      regionScope: browseState.regionScope
    }).all.length;
  }, [browseState.regionScope, data]);
  const comparisonEntities = useMemo(() => {
    return browseState.compareEntityIds.flatMap((entityId) => {
      const entity = data.entities.find(({ id }) => id === entityId);
      return entity ? [entity] : [];
    });
  }, [browseState.compareEntityIds, data.entities]);

  const toggleComparison = useCallback(
    (entityId: string) => {
      setBrowseState((current) => {
        if (current.compareEntityIds.includes(entityId)) {
          return {
            ...current,
            compareEntityIds: current.compareEntityIds.filter((id) => id !== entityId)
          };
        }
        if (current.compareEntityIds.length >= 2) return current;
        return { ...current, compareEntityIds: [...current.compareEntityIds, entityId] };
      });
    },
    [setBrowseState]
  );

  useEffect(() => {
    // 等待原生 dialog 卸载后再恢复焦点，避免浏览器默认焦点处理覆盖结果。
    if (browseState.detailEntityId) return;
    const animationFrame = requestAnimationFrame(() => {
      if (focusComparisonRef.current) {
        focusComparisonRef.current = false;
        comparisonRef.current?.focus({ preventScroll: true });
        comparisonRef.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
        // 为当前尺寸下的吸顶控件保留实际高度，避免对比标题被遮挡。
        const toolbar = mainRef.current?.querySelector<HTMLElement>(
          ".mobile-explore-bar, .compact-console-slot"
        );
        if (toolbar?.offsetHeight) {
          window.scrollBy({
            top: -(toolbar.offsetHeight + (parseFloat(getComputedStyle(toolbar).top) || 0)),
            behavior: "instant"
          });
        }
      } else {
        lastTriggerRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [browseState.detailEntityId]);

  /** 记录触发元素、打开对应实体详情并启动按需加载。 */
  const openDetail = (entityId: string, trigger: HTMLButtonElement | null) => {
    lastTriggerRef.current = trigger;
    setBrowseState((current) => ({ ...current, detailEntityId: entityId }));
  };

  /** 关闭详情；焦点恢复由上方 effect 在卸载完成后处理。 */
  const closeDetail = useCallback(() => {
    setBrowseState((current) => ({ ...current, detailEntityId: null }));
  }, [setBrowseState]);

  const compareFromDetail = (relatedEntityId: string) => {
    if (!selectedMatch) return;
    focusComparisonRef.current = true;
    setBrowseState((current) => ({
      ...current,
      detailEntityId: null,
      compareEntityIds: [selectedMatch.entity.id, relatedEntityId]
    }));
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <AppHeader
        entityCount={data.entities.length}
        timelineSectionCount={data.timelineSections.length}
      />

      <main
        ref={mainRef}
        id="main-content"
        className={`site-shell${browseState.viewMode === "map" ? " map-view-active" : ""}`}
      >
        <BrowseControls
          browseState={browseState}
          setBrowseState={setBrowseState}
          yearBounds={yearBounds}
          regions={data.regions}
          resultCount={results.all.length}
        />

        <section className="exploration-summary" aria-label="当前范围和结果摘要">
          <BrowseResultsSummary
            browseState={browseState}
            resultCount={results.all.length}
            overviewTotal={overviewTotal}
            overviewGroupCount={overviewGroups.length}
            mapPolityCount={results.polities.length}
            mapSelection={mapSelection}
            boundarySelection={boundarySelection}
          />
          <BrowseScopeNote regionScope={browseState.regionScope} />
        </section>

        <section className="exploration-content" aria-label="主要探索内容">
          <BrowseContent
            data={data}
            browseState={browseState}
            results={results}
            geographyState={geographyState}
            mapSelection={mapSelection}
            boundarySelection={boundarySelection}
            boundaryState={boundaryState}
            onRetryGeography={retryGeography}
            onRetryBoundaries={retryBoundaries}
            onSelect={openDetail}
            onToggleComparison={toggleComparison}
          />
        </section>

        {comparisonEntities.length > 0 && (
          <aside
            ref={comparisonRef}
            className="exploration-assistance"
            aria-label="对比工具"
            tabIndex={-1}
          >
            <ComparisonPanel
              entities={comparisonEntities}
              regions={data.regions}
              {...(browseState.timeRange === "year" ? { currentYear: browseState.year } : {})}
              loadDetail={loadDetail}
              onRemove={toggleComparison}
              onClear={() => setBrowseState((current) => ({ ...current, compareEntityIds: [] }))}
            />
          </aside>
        )}

        <AppFooter />
      </main>

      {selectedMatch && (
        <DetailDialog
          entity={selectedMatch.entity}
          entities={data.entities}
          sectionTitle={selectedMatch.section?.title}
          regions={data.regions}
          detailState={detailState}
          {...(browseState.timeRange === "year" ? { currentYear: browseState.year } : {})}
          onRetry={retryDetail}
          onClose={closeDetail}
          onCompare={compareFromDetail}
        />
      )}
    </>
  );
}
