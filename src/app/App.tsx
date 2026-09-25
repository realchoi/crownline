import { useCallback, useMemo, useRef, useState } from "react";

import { DetailDialog } from "../components/DetailDialog";
import { ComparisonDialog } from "../components/ComparisonDialog";
import { useDialogReturnFocus } from "./useDialogReturnFocus";
import { ComparisonTray } from "../components/ComparisonTray";
import { getEffectiveTimeWindow, getHistoricalYearBounds } from "../domain/browseState";
import { selectBoundarySnapshots, type BoundarySelection } from "../domain/boundarySnapshots";
import { buildOverviewTimelineGroups } from "../domain/overviewTimeline";
import { selectMapSnapshots } from "../domain/mapSnapshots";
import { createRegionScopeMatcher } from "../domain/regionScope";
import { selectBrowseResults } from "../domain/selectors";
import type { TimeWindow } from "../domain/timeWindow";
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
    entities: data.entities,
    boundariesAvailable: data.boundarySnapshotCount > 0
  });
  const { detailState, retry: retryDetail } = useEntityDetail(
    browseState.detailEntityId,
    data.detailEntityIds,
    loadDetail
  );
  const { geographyState, retry: retryGeography } = useGeographyData(
    browseState.viewMode,
    browseState.mapLayer,
    loadGeography
  );
  const { boundaryState, retry: retryBoundaries } = useBoundaryData(
    browseState.viewMode,
    browseState.mapLayer,
    loadBoundaries
  );
  const [comparisonOrigin, setComparisonOrigin] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  useDialogReturnFocus(Boolean(browseState.detailEntityId || browseState.comparisonOpen), mainRef);
  const { query, category, regionScope } = browseState;
  const selectedYear = browseState.timeRange === "year" ? browseState.year : undefined;
  const timeWindow = getEffectiveTimeWindow(browseState);
  const windowStart = timeWindow?.startYear;
  const windowEnd = timeWindow?.endYear;
  // 只随筛选相关状态重算；打开详情或调整对比不触发。
  const results = useMemo(() => {
    const filters = { query, category, regionScope };
    if (selectedYear !== undefined)
      return selectBrowseResults(data, { ...filters, year: selectedYear });
    if (windowStart !== undefined && windowEnd !== undefined) {
      return selectBrowseResults(data, {
        ...filters,
        timeWindow: { startYear: windowStart, endYear: windowEnd }
      });
    }
    return selectBrowseResults(data, filters);
  }, [category, data, query, regionScope, selectedYear, windowStart, windowEnd]);
  const entityById = useMemo(() => {
    return new Map(data.entities.map((entity) => [entity.id, entity]));
  }, [data.entities]);
  const sectionByEntityId = useMemo(() => {
    const sections = new Map<string, TimelineSection>();
    data.timelineSections.forEach((section) => {
      section.entityIds.forEach((entityId) => sections.set(entityId, section));
    });
    return sections;
  }, [data.timelineSections]);
  const mapSelection = useMemo(() => {
    if (geographyState.status !== "ready") return null;
    return selectMapSnapshots(
      results.polities.map(({ entity }) => entity),
      geographyState.result.geography.geographicSnapshots,
      selectedYear
    );
  }, [geographyState, results.polities, selectedYear]);
  const boundarySelection = useMemo<BoundarySelection | null>(() => {
    if (boundaryState.status !== "ready") return null;
    return selectBoundarySnapshots(
      results.polities.map(({ entity }) => entity),
      boundaryState.result.boundaries.boundarySnapshots,
      selectedYear
    );
  }, [boundaryState, results.polities, selectedYear]);
  // 即使筛选状态变化，也要允许已打开的详情继续读取完整实体记录。
  const selectedEntity = browseState.detailEntityId
    ? entityById.get(browseState.detailEntityId)
    : undefined;
  const overviewGroups = useMemo(() => {
    return buildOverviewTimelineGroups(data, results.all, regionScope);
  }, [data, regionScope, results.all]);
  const overviewTotal = useMemo(() => {
    return data.entities.filter(createRegionScopeMatcher(data.regions, regionScope)).length;
  }, [data.entities, data.regions, regionScope]);
  const comparisonEntities = useMemo(() => {
    return browseState.compareEntityIds.flatMap((entityId) => {
      const entity = entityById.get(entityId);
      return entity ? [entity] : [];
    });
  }, [browseState.compareEntityIds, entityById]);

  const toggleComparison = useCallback(
    (entityId: string) => {
      setBrowseState((current) => {
        if (current.compareEntityIds.includes(entityId)) {
          return {
            ...current,
            compareEntityIds: current.compareEntityIds.filter((id) => id !== entityId),
            comparisonOpen: current.comparisonOpen && current.compareEntityIds.length > 1
          };
        }
        if (current.compareEntityIds.length >= 2) return current;
        return { ...current, compareEntityIds: [...current.compareEntityIds, entityId] };
      });
    },
    [setBrowseState]
  );

  const setTimeWindow = useCallback(
    (nextWindow: TimeWindow | null) => {
      setBrowseState((current) => ({ ...current, timeWindow: nextWindow }));
    },
    [setBrowseState]
  );

  const openDetail = (entityId: string) => {
    setBrowseState((current) => ({ ...current, detailEntityId: entityId, comparisonOpen: false }));
  };

  const closeComparison = useCallback(() => {
    setBrowseState((current) => ({ ...current, comparisonOpen: false }));
  }, [setBrowseState]);

  /** 关闭详情；焦点与浏览位置由 useDialogReturnFocus 统一恢复。 */
  const closeDetail = useCallback(() => {
    setBrowseState((current) => ({ ...current, detailEntityId: null }));
  }, [setBrowseState]);

  const compareFromDetail = (relatedEntityId: string) => {
    if (!selectedEntity) return;
    setComparisonOrigin(selectedEntity.id);
    setBrowseState((current) => ({
      ...current,
      detailEntityId: null,
      compareEntityIds: [selectedEntity.id, relatedEntityId],
      comparisonOpen: true
    }));
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <AppHeader
        polityCount={data.entities.filter(({ entityKind }) => entityKind === "polity").length}
        historicalPeriodCount={
          data.entities.filter(({ entityKind }) => entityKind === "historical-period").length
        }
      />

      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className={`site-shell${browseState.viewMode === "map" ? " map-view-active" : ""}${comparisonEntities.length > 0 ? " has-comparison-tray" : ""}`}
      >
        <BrowseControls
          browseState={browseState}
          setBrowseState={setBrowseState}
          yearBounds={yearBounds}
          regions={data.regions}
          resultCount={results.all.length}
          boundarySnapshotCount={data.boundarySnapshotCount}
        />

        <section className="exploration-summary" aria-label="当前范围和结果摘要">
          <BrowseResultsSummary
            browseState={browseState}
            regions={data.regions}
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
            overviewGroups={overviewGroups}
            geographyState={geographyState}
            mapSelection={mapSelection}
            boundarySelection={boundarySelection}
            boundaryState={boundaryState}
            onRetryGeography={retryGeography}
            onRetryBoundaries={retryBoundaries}
            yearBounds={yearBounds}
            onTimeWindowChange={setTimeWindow}
            onSelect={openDetail}
            onToggleComparison={toggleComparison}
          />
        </section>

        <AppFooter />
      </main>

      {comparisonEntities.length > 0 && (
        <ComparisonTray
          entities={comparisonEntities}
          onRemove={toggleComparison}
          onClear={() => {
            setBrowseState((current) => ({ ...current, compareEntityIds: [] }));
            // 快捷栏随清空卸载，焦点交还主内容而不是落到 body。
            mainRef.current?.focus({ preventScroll: true });
          }}
          onView={() => {
            setComparisonOrigin(null);
            setBrowseState((current) => ({ ...current, comparisonOpen: true }));
          }}
        />
      )}

      {browseState.comparisonOpen && comparisonEntities.length > 0 && !selectedEntity && (
        <ComparisonDialog
          entities={comparisonEntities}
          regions={data.regions}
          {...(browseState.timeRange === "year" ? { currentYear: browseState.year } : {})}
          loadDetail={loadDetail}
          onRemove={toggleComparison}
          onClear={() =>
            setBrowseState((current) => ({
              ...current,
              compareEntityIds: [],
              comparisonOpen: false
            }))
          }
          onClose={closeComparison}
          {...(comparisonOrigin ? { onReturnToDetail: () => openDetail(comparisonOrigin) } : {})}
        />
      )}

      {selectedEntity && (
        <DetailDialog
          entity={selectedEntity}
          entities={data.entities}
          sectionTitle={sectionByEntityId.get(selectedEntity.id)?.title}
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
