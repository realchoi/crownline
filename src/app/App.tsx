import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DetailDialog } from "../components/DetailDialog";
import { FilterPanel } from "../components/FilterPanel";
import { Timeline } from "../components/Timeline";
import { filterEntities, type CategoryFilter } from "../domain/selectors";
import type { CrownlineData, DisplayCategory } from "../domain/types";

/** 应用根组件接收的已校验数据。 */
interface AppProps {
  data: CrownlineData;
}

/** 当前版本允许从 URL 恢复的筛选类别。 */
const VALID_CATEGORIES = new Set<CategoryFilter>([
  "all",
  "mainline",
  "contemporary",
  "regional",
  "context"
]);

/** 兼容旧静态页面已经分享出去的类别参数。 */
const LEGACY_CATEGORY_MAP: Record<string, DisplayCategory> = {
  main: "mainline",
  parallel: "contemporary",
  period: "context",
  regional: "regional"
};

/** 从当前 URL 读取并清洗初始筛选状态。 */
function initialFilters(): { query: string; category: CategoryFilter } {
  const params = new URLSearchParams(window.location.search);
  const rawCategory = params.get("type") ?? "all";
  const mappedCategory = LEGACY_CATEGORY_MAP[rawCategory] ?? rawCategory;
  return {
    query: params.get("q") ?? "",
    category: VALID_CATEGORIES.has(mappedCategory as CategoryFilter)
      ? (mappedCategory as CategoryFilter)
      : "all"
  };
}

/** 组合筛选状态、时间轴、详情弹窗和 URL 同步的应用根组件。 */
export function App({ data }: AppProps) {
  const initial = useMemo(initialFilters, []);
  const [query, setQuery] = useState(initial.query);
  const [category, setCategory] = useState<CategoryFilter>(initial.category);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const matches = useMemo(() => filterEntities(data, query, category), [data, query, category]);
  // 即使筛选状态变化，也要允许已打开的详情继续读取完整实体记录。
  const selectedMatch = selectedEntityId
    ? matches.find(({ entity }) => entity.id === selectedEntityId) ??
      data.timelineSections
        .flatMap((section) => {
          return data.entities
            .filter((entity) => section.entityIds.includes(entity.id))
            .map((entity) => ({ entity, section }));
        })
        .find(({ entity }) => entity.id === selectedEntityId)
    : undefined;
  const visibleSections = new Set(matches.map(({ section }) => section.id)).size;

  useEffect(() => {
    // 使用 replaceState 避免用户每输入一个字符就新增一条浏览器历史。
    const params = new URLSearchParams(window.location.search);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    if (category !== "all") params.set("type", category);
    else params.delete("type");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, [category, query]);

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
          沿时间线探索世界王朝、帝国与文明的兴衰。当前版本收录中国历代王朝与主要政权：从夏商周到明清，按历史阶段查看主线王朝、主要并立政权、常见历史分期及若干重要区域政权；每个阶段采用局部时间尺度，让短暂政权也能清晰呈现。世界其他地区的数据将在后续版本中逐步加入。
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
          query={query}
          category={category}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
          onClear={() => {
            setQuery("");
            setCategory("all");
          }}
        />

        <aside className="scope-note" aria-label="收录口径说明">
          <span className="scope-icon" aria-hidden="true">
            注
          </span>
          <p>
            “所有朝代”并不存在完全统一的学术边界。本页采用通史常见口径：覆盖主线王朝、分裂时期的主要政权，并补充少量重要区域政权；不把每一个地方割据、农民政权或短暂称帝政权都列为独立“朝代”。部分起止年会因建国、改元、灭亡或入主中原的判定不同而存在差异。
          </p>
        </aside>

        <div className="results-line">
          <span>{`显示 ${matches.length} / ${data.entities.length} 个条目，涉及 ${visibleSections} 个历史阶段`}</span>
          <span>点击任意时间条查看说明</span>
        </div>

        <Timeline data={data} matches={matches} onSelect={openDetail} />

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
          sectionTitle={selectedMatch.section.title}
          onClose={closeDetail}
        />
      )}
    </>
  );
}
