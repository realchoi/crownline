import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DetailDialog } from "../components/DetailDialog";
import { FilterPanel } from "../components/FilterPanel";
import { Timeline } from "../components/Timeline";
import { TimepointView } from "../components/TimepointView";
import {
  getHistoricalYearBounds,
  readBrowseState,
  writeBrowseState,
  type BrowseState
} from "../domain/browseState";
import { buildOverviewTimelineGroups } from "../domain/overviewTimeline";
import { selectBrowseResults } from "../domain/selectors";
import type { CrownlineData } from "../domain/types";

/** 应用根组件接收的已校验数据。 */
interface AppProps {
  data: CrownlineData;
}

/** 组合筛选状态、时间轴、详情弹窗和 URL 同步的应用根组件。 */
export function App({ data }: AppProps) {
  const yearBounds = useMemo(() => getHistoricalYearBounds(data), [data]);
  const [browseState, setBrowseState] = useState<BrowseState>(() => {
    return readBrowseState(window.location.search, yearBounds, data.regions);
  });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
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
    const sectionByEntityId = new Map<string, CrownlineData["timelineSections"][number]>();
    data.timelineSections.forEach((section) => {
      section.entityIds.forEach((entityId) => sectionByEntityId.set(entityId, section));
    });
    return data.entities.map((entity) => ({ entity, section: sectionByEntityId.get(entity.id) }));
  }, [data]);
  // 即使筛选状态变化，也要允许已打开的详情继续读取完整实体记录。
  const selectedMatch = selectedEntityId
    ? allMatches.find(({ entity }) => entity.id === selectedEntityId)
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

  useEffect(() => {
    const params = writeBrowseState(browseState, yearBounds, window.location.search);
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, [browseState, yearBounds]);

  useEffect(() => {
    // 等待原生 dialog 卸载后再恢复焦点，避免浏览器默认焦点处理覆盖结果。
    if (selectedEntityId || !lastTriggerRef.current) return;
    const animationFrame = requestAnimationFrame(() => lastTriggerRef.current?.focus());
    return () => cancelAnimationFrame(animationFrame);
  }, [selectedEntityId]);

  /** 记录触发元素并打开对应实体详情。 */
  const openDetail = (entityId: string, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setSelectedEntityId(entityId);
  };

  /** 关闭详情；焦点恢复由上方 effect 在卸载完成后处理。 */
  const closeDetail = useCallback(() => {
    setSelectedEntityId(null);
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="hero site-shell">
        <p className="eyebrow">交互式王朝图谱</p>
        <h1 aria-label="Crownline · 王冠纪">
          <span className="site-title-brand">
            <span className="brand-latin">Crownline</span>
            <span className="brand-dot">·</span>
            <span className="brand-zh">王冠纪</span>
          </span>
          <span className="site-title-sub">世界王朝与帝国时间轴</span>
        </h1>
        <p className="hero-copy">
          沿时间线探索世界王朝、帝国与文明的兴衰。中国范围按历史阶段浏览；自选地区与全球已收录采用统一时间比例，便于比较不同政权的先后与存续长度。外部地区仍属样本数据，不代表全球历史已完整收录。
        </p>
        <div className="stat-grid" aria-label="时间轴概览">
          <div className="stat-card">
            <span className="stat-label">覆盖时段</span>
            <strong className="stat-value">约前2070—1912</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">收录条目</span>
            <strong className="stat-value">{data.entities.length} 个</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">历史阶段</span>
            <strong className="stat-value">{data.timelineSections.length} 个</strong>
          </div>
        </div>
      </header>

      <main id="main-content" className="site-shell">
        <FilterPanel
          mode={browseState.mode}
          year={browseState.year}
          yearBounds={yearBounds}
          query={browseState.query}
          category={browseState.category}
          regions={data.regions}
          regionScope={browseState.regionScope}
          onModeChange={(mode) => setBrowseState((current) => ({ ...current, mode }))}
          onYearChange={(year) => setBrowseState((current) => ({ ...current, year }))}
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

        <div className="results-line" role="status" aria-atomic="true">
          {browseState.mode === "overview" ? (
            <>
              <span>
                {browseState.regionScope.mode === "china"
                  ? `显示 ${results.all.length} / ${overviewTotal} 个条目，涉及 ${overviewGroups.length} 个历史阶段`
                  : `显示 ${results.all.length} / ${overviewTotal} 个条目，分为 ${overviewGroups.length} 个时间轴组`}
              </span>
              <span>点击任意时间条查看说明</span>
            </>
          ) : (
            <>
              <span>{`显示 ${results.polities.length} 个政权，另有 ${results.historicalPeriods.length} 条历史背景`}</span>
              <span>点击任意条目查看说明</span>
            </>
          )}
        </div>

        {browseState.mode === "overview" ? (
          <Timeline
            data={data}
            matches={results.all}
            regions={data.regions}
            regionScope={browseState.regionScope}
            emptyReason={results.polityEmptyReason}
            onSelect={openDetail}
          />
        ) : (
          <TimepointView
            year={browseState.year}
            polities={results.polities}
            historicalPeriods={results.historicalPeriods}
            regions={data.regions}
            regionScope={browseState.regionScope}
            polityEmptyReason={results.polityEmptyReason}
            onSelect={openDetail}
          />
        )}

        <footer className="footer-note">
          <p>
            <strong>纪年说明：</strong>
            夏、商早期年代使用常见估年；清朝可从 1636 年改国号或 1644
            年入关起算；南明等政权的终止年份亦有不同口径。页面中的说明用于通史浏览，不替代专业断代研究。
          </p>
          <p>
            <strong>资料参考：</strong>
            <a
              href="https://scopsr.gov.cn/zlzx/lsgk/201811/t20181120_326615.html"
              target="_blank"
              rel="noreferrer"
            >
              《中国历史纪年简表》
            </a>
            、
            <a href="https://www.chnmuseum.cn/" target="_blank" rel="noreferrer">
              中国国家博物馆
            </a>
            的中国古代史分期，以及通行历史年表。
          </p>
          <p>
            <strong>Crownline · 王冠纪</strong>——沿时间线探索世界王朝、帝国与文明的兴衰。
          </p>
        </footer>
      </main>

      {selectedMatch && (
        <DetailDialog
          entity={selectedMatch.entity}
          sectionTitle={selectedMatch.section?.title}
          data={data}
          {...(browseState.mode === "point" ? { currentYear: browseState.year } : {})}
          onClose={closeDetail}
        />
      )}
    </>
  );
}
