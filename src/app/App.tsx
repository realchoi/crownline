import { useCallback, useEffect, useMemo, useRef } from "react";

import { DetailDialog } from "../components/DetailDialog";
import { ComparisonPanel } from "../components/ComparisonPanel";
import { FilterPanel } from "../components/FilterPanel";
import { ViewModeControl } from "../components/ViewModeControl";
import { getHistoricalYearBounds } from "../domain/browseState";
import { buildOverviewTimelineGroups } from "../domain/overviewTimeline";
import { selectMapSnapshots } from "../domain/mapSnapshots";
import { selectBrowseResults } from "../domain/selectors";
import type { CrownlineIndex, TimelineSection } from "../domain/types";
import type { CrownlineDetailLoader } from "../data/loadCrownlineDetail";
import type { CrownlineGeographyLoader } from "../data/loadCrownlineGeography";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { BrowseContent } from "./BrowseContent";
import { BrowseResultsSummary } from "./BrowseResultsSummary";
import { useBrowseUrlState } from "./useBrowseUrlState";
import { useEntityDetail } from "./useEntityDetail";
import { useGeographyData } from "./useGeographyData";

/** 应用根组件接收的已校验数据。 */
interface AppProps {
  data: CrownlineIndex;
  loadDetail: CrownlineDetailLoader;
  loadGeography: CrownlineGeographyLoader;
}

/** 组合筛选状态、时间轴、详情弹窗和 URL 同步的应用根组件。 */
export function App({ data, loadDetail, loadGeography }: AppProps) {
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
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const controlsPanelRef = useRef<HTMLElement>(null);
  const results = useMemo(() => {
    const filters = {
      query: browseState.query,
      category: browseState.category,
      regionScope: browseState.regionScope
    };
    return browseState.mode === "point"
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
      browseState.mode === "point" ? browseState.year : undefined
    );
  }, [browseState.mode, browseState.year, geographyState, results.polities]);
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
    const main = mainRef.current;
    const controlsPanel = controlsPanelRef.current;
    if (browseState.viewMode !== "map" || !main || !controlsPanel) {
      main?.style.removeProperty("--map-controls-height");
      return;
    }

    const syncControlsHeight = () => {
      main.style.setProperty(
        "--map-controls-height",
        `${controlsPanel.getBoundingClientRect().height}px`
      );
    };
    syncControlsHeight();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncControlsHeight);
    observer.observe(controlsPanel);
    return () => observer.disconnect();
  }, [browseState.viewMode]);

  useEffect(() => {
    // 等待原生 dialog 卸载后再恢复焦点，避免浏览器默认焦点处理覆盖结果。
    if (browseState.detailEntityId || !lastTriggerRef.current) return;
    const animationFrame = requestAnimationFrame(() => lastTriggerRef.current?.focus());
    return () => cancelAnimationFrame(animationFrame);
  }, [browseState.detailEntityId]);

  /** 记录触发元素、打开对应实体详情并启动按需加载。 */
  const openDetail = (entityId: string, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setBrowseState((current) => ({ ...current, detailEntityId: entityId }));
  };

  /** 关闭详情；焦点恢复由上方 effect 在卸载完成后处理。 */
  const closeDetail = useCallback(() => {
    setBrowseState((current) => ({ ...current, detailEntityId: null }));
  }, [setBrowseState]);

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
        <ViewModeControl
          value={browseState.viewMode}
          onChange={(viewMode) => setBrowseState((current) => ({ ...current, viewMode }))}
        />
        <FilterPanel
          panelRef={controlsPanelRef}
          showModeSwitch={browseState.viewMode === "timeline"}
          showYearControls={browseState.viewMode === "map" || browseState.mode === "point"}
          mode={browseState.mode}
          year={browseState.year}
          yearBounds={yearBounds}
          query={browseState.query}
          category={browseState.category}
          regions={data.regions}
          regionScope={browseState.regionScope}
          onModeChange={(mode) => setBrowseState((current) => ({ ...current, mode }))}
          onYearChange={(year) =>
            setBrowseState((current) => ({
              ...current,
              year,
              mode: current.viewMode === "map" ? "point" : current.mode
            }))
          }
          onQueryChange={(query) => setBrowseState((current) => ({ ...current, query }))}
          onCategoryChange={(category) => {
            setBrowseState((current) => ({ ...current, category }));
          }}
          onRegionScopeChange={(regionScope) => {
            setBrowseState((current) => ({ ...current, regionScope }));
          }}
          onClear={() => {
            setBrowseState((current) => ({ ...current, query: "", category: "all" }));
          }}
        />

        <aside className="scope-note" aria-label="收录口径说明">
          <span className="scope-icon" aria-hidden="true">
            注
          </span>
          <p>
            {browseState.regionScope.mode === "china"
              ? "“所有朝代”并不存在完全统一的学术边界。中国范围采用通史常见口径：覆盖主线王朝、分裂时期的主要政权，并补充少量重要区域政权；不把每一个地方割据、农民政权或短暂称帝政权都列为独立“朝代”。"
              : "跨地区内容目前只用于验证地区机制，每个外部地区仅有少量代表条目。“全球已收录”表示当前数据集中的全部内容，不表示世界历史已经完整覆盖；空结果也不表示该地区当时没有政权。"}
          </p>
        </aside>

        <BrowseResultsSummary
          browseState={browseState}
          resultCount={results.all.length}
          overviewTotal={overviewTotal}
          overviewGroupCount={overviewGroups.length}
          mapPolityCount={results.polities.length}
          mapSelection={mapSelection}
        />

        {comparisonEntities.length > 0 && (
          <ComparisonPanel
            entities={comparisonEntities}
            regions={data.regions}
            {...(browseState.mode === "point" ? { currentYear: browseState.year } : {})}
            loadDetail={loadDetail}
            onRemove={toggleComparison}
            onClear={() => {
              setBrowseState((current) => ({ ...current, compareEntityIds: [] }));
            }}
          />
        )}

        <BrowseContent
          data={data}
          browseState={browseState}
          results={results}
          geographyState={geographyState}
          mapSelection={mapSelection}
          onRetryGeography={retryGeography}
          onSelect={openDetail}
          onToggleComparison={toggleComparison}
        />

        <AppFooter />
      </main>

      {selectedMatch && (
        <DetailDialog
          entity={selectedMatch.entity}
          sectionTitle={selectedMatch.section?.title}
          regions={data.regions}
          detailState={detailState}
          {...(browseState.mode === "point" ? { currentYear: browseState.year } : {})}
          onRetry={retryDetail}
          onClose={closeDetail}
        />
      )}
    </>
  );
}
