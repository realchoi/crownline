import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";

import { ActiveFilterChips } from "../components/ActiveFilterChips";
import { FilterPanel } from "../components/FilterPanel";
import { ViewModeControl } from "../components/ViewModeControl";
import { useModalDialog } from "../components/useModalDialog";
import {
  clearAdditionalFilters,
  getEffectiveTimeWindow,
  selectBrowseYear,
  selectTimeRange,
  type BrowseState,
  type HistoricalYearBounds
} from "../domain/browseState";
import { formatHistoricalYear } from "../domain/chronology";
import { getRegionScopeLabel } from "../domain/regionScope";
import { formatTimeWindow } from "../domain/timeWindow";
import type { Region } from "../domain/types";
import { useStickyHeaderOffset } from "./useStickyHeaderOffset";

/** 与 controls.css 中 .compact-console-slot 的 top 保持一致。 */
const COMPACT_CONSOLE_TOP = 8;

interface BrowseControlsProps {
  browseState: BrowseState;
  setBrowseState: Dispatch<SetStateAction<BrowseState>>;
  yearBounds: HistoricalYearBounds;
  regions: Region[];
  resultCount: number;
  boundarySnapshotCount: number;
}

const MOBILE_CONTROLS_QUERY = "(max-width: 800px)";

function useMobileControls() {
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_CONTROLS_QUERY).matches
      : false;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(MOBILE_CONTROLS_QUERY);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

/** 完整控制台、滚动后工具条和响应式筛选面板的页面级组合。 */
export function BrowseControls({
  browseState,
  setBrowseState,
  yearBounds,
  regions,
  resultCount,
  boundarySnapshotCount
}: BrowseControlsProps) {
  const isMobile = useMobileControls();
  const [isCompact, setIsCompact] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const fullConsoleRef = useRef<HTMLElement>(null);
  const mobileBarRef = useRef<HTMLDivElement>(null);
  const compactBarRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const hasOpenedSheetRef = useRef(false);
  const scopeLabel = getRegionScopeLabel(browseState.regionScope, regions);
  const timeWindow = getEffectiveTimeWindow(browseState);
  const timeLabel =
    browseState.timeRange === "year"
      ? formatHistoricalYear({ year: browseState.year, precision: "exact" })
      : timeWindow
        ? formatTimeWindow(timeWindow)
        : "全时期";
  const activeFilterCount =
    (browseState.query.trim() ? 1 : 0) +
    (browseState.category !== "all" ? 1 : 0) +
    (browseState.regionScope.mode === "custom" ? browseState.regionScope.regionIds.length : 0);

  useEffect(() => {
    if (isMobile) {
      setIsCompact(false);
      return;
    }

    let frame = 0;
    const syncCompactState = () => {
      frame = 0;
      const rect = fullConsoleRef.current?.getBoundingClientRect();
      if (!rect || (rect.height === 0 && rect.bottom === 0)) return;
      setIsCompact((current) => (current ? rect.bottom < 88 : rect.bottom < 12));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(syncCompactState);
    };
    syncCompactState();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isMobile]);

  useStickyHeaderOffset(
    isMobile ? mobileBarRef : compactBarRef,
    isMobile || isCompact,
    isMobile ? 0 : COMPACT_CONSOLE_TOP
  );

  const closeSheet = useCallback(() => setIsSheetOpen(false), []);
  useModalDialog(dialogRef, {
    open: isSheetOpen,
    onClose: closeSheet,
    initialFocusRef: sheetCloseRef
  });

  useEffect(() => {
    if (isSheetOpen) {
      hasOpenedSheetRef.current = true;
      document.body.classList.add("filter-sheet-open");
      return;
    }
    document.body.classList.remove("filter-sheet-open");
    if (hasOpenedSheetRef.current) {
      const frame = requestAnimationFrame(() =>
        (sheetTriggerRef.current ?? fullConsoleRef.current)?.focus({ preventScroll: true })
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [isSheetOpen]);

  useEffect(() => () => document.body.classList.remove("filter-sheet-open"), []);

  const updateState = useMemo(
    () => ({
      onViewModeChange: (viewMode: BrowseState["viewMode"]) =>
        setBrowseState((current) => ({ ...current, viewMode })),
      onTimeRangeChange: (timeRange: BrowseState["timeRange"]) =>
        setBrowseState((current) => selectTimeRange(current, timeRange)),
      onYearChange: (year: number) => setBrowseState((current) => selectBrowseYear(current, year)),
      onMapLayerChange: (mapLayer: BrowseState["mapLayer"]) =>
        setBrowseState((current) => ({ ...current, mapLayer })),
      onQueryChange: (query: string) => setBrowseState((current) => ({ ...current, query })),
      onCategoryChange: (category: BrowseState["category"]) =>
        setBrowseState((current) => ({ ...current, category })),
      onRegionScopeChange: (regionScope: BrowseState["regionScope"]) =>
        setBrowseState((current) => ({ ...current, regionScope })),
      onClear: () => setBrowseState(clearAdditionalFilters),
      onTimeWindowChange: (timeWindow: BrowseState["timeWindow"]) =>
        setBrowseState((current) => ({ ...current, timeWindow }))
    }),
    [setBrowseState]
  );

  const renderConsole = (layout: "full" | "toolbar") => (
    <>
      <FilterPanel
        layout={layout}
        viewMode={browseState.viewMode}
        mapLayer={browseState.mapLayer}
        timeRange={browseState.timeRange}
        year={browseState.year}
        yearBounds={yearBounds}
        query={browseState.query}
        category={browseState.category}
        regions={regions}
        regionScope={browseState.regionScope}
        boundarySnapshotCount={boundarySnapshotCount}
        onViewModeChange={updateState.onViewModeChange}
        onTimeRangeChange={updateState.onTimeRangeChange}
        onYearChange={updateState.onYearChange}
        onMapLayerChange={updateState.onMapLayerChange}
        onQueryChange={updateState.onQueryChange}
        onCategoryChange={updateState.onCategoryChange}
        onRegionScopeChange={updateState.onRegionScopeChange}
      />
      <ActiveFilterChips
        query={browseState.query}
        category={browseState.category}
        regionScope={browseState.regionScope}
        regions={regions}
        timeWindow={timeWindow}
        onTimeWindowChange={updateState.onTimeWindowChange}
        onQueryChange={updateState.onQueryChange}
        onCategoryChange={updateState.onCategoryChange}
        onRegionScopeChange={updateState.onRegionScopeChange}
        onClearAdditional={updateState.onClear}
      />
    </>
  );

  const statusItems = (
    <div className="console-status-items" aria-label="当前探索状态">
      <span>
        <small>呈现</small>
        {browseState.viewMode === "timeline" ? "时间轴" : "地图"}
      </span>
      <span>
        <small>时间</small>
        {timeLabel}
      </span>
      <span>
        <small>范围</small>
        {scopeLabel}
      </span>
      <span>
        <small>筛选</small>
        {activeFilterCount > 0 ? `${activeFilterCount} 项` : "无"}
      </span>
    </div>
  );

  return (
    <section className="exploration-controls" aria-label="探索控制区">
      {isMobile ? (
        <>
          <div ref={mobileBarRef} className="mobile-explore-bar">
            <div className="mobile-explore-heading">
              <ViewModeControl
                value={browseState.viewMode}
                onChange={updateState.onViewModeChange}
              />
              <button
                ref={sheetTriggerRef}
                className="open-filter-button"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isSheetOpen}
                aria-controls="filter-sheet"
                onClick={() => setIsSheetOpen(true)}
              >
                筛选{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </button>
            </div>
            <ActiveFilterChips
              query={browseState.query}
              category={browseState.category}
              regionScope={browseState.regionScope}
              regions={regions}
              timeWindow={timeWindow}
              onTimeWindowChange={updateState.onTimeWindowChange}
              onQueryChange={updateState.onQueryChange}
              onCategoryChange={updateState.onCategoryChange}
              onRegionScopeChange={updateState.onRegionScopeChange}
              onClearAdditional={updateState.onClear}
            />
          </div>
        </>
      ) : (
        <>
          <section ref={fullConsoleRef} className="full-exploration-console" tabIndex={-1}>
            {renderConsole("toolbar")}
          </section>
          <div className="compact-console-slot">
            {isCompact && (
              <div
                ref={compactBarRef}
                className="compact-console-bar"
                role="region"
                aria-label="紧凑探索工具条"
              >
                {statusItems}
                <button
                  className="expand-console-button"
                  type="button"
                  ref={sheetTriggerRef}
                  aria-haspopup="dialog"
                  aria-expanded={isSheetOpen}
                  aria-controls="filter-sheet"
                  onClick={() => setIsSheetOpen(true)}
                >
                  展开控制台
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <dialog
        id="filter-sheet"
        ref={dialogRef}
        className="filter-sheet"
        aria-labelledby="filter-sheet-title"
        onClose={() => setIsSheetOpen(false)}
      >
        <div className="filter-sheet-frame">
          <header className="filter-sheet-heading">
            <div>
              <span className="console-kicker">Explore / 探索</span>
              <h2 id="filter-sheet-title">筛选与呈现</h2>
            </div>
            <button ref={sheetCloseRef} type="button" aria-label="关闭筛选" onClick={closeSheet}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className="filter-sheet-scroll">{isSheetOpen && renderConsole("full")}</div>
          <footer className="filter-sheet-footer">
            <button type="button" onClick={closeSheet}>
              查看 {resultCount} 个结果
            </button>
          </footer>
        </div>
      </dialog>
    </section>
  );
}
