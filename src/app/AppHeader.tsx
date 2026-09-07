interface AppHeaderProps {
  entityCount: number;
  timelineSectionCount: number;
}

/** Static product introduction and generated-data totals. */
export function AppHeader({ entityCount, timelineSectionCount }: AppHeaderProps) {
  return (
    <header className="hero site-shell">
      <h1 aria-label="Crownline · 王冠纪">
        <span className="site-title-brand">
          <span className="brand-latin">Crownline</span>
          <span className="brand-dot">·</span>
          <span className="brand-zh">王冠纪</span>
        </span>
        <span className="site-title-sub">世界王朝与帝国时间轴</span>
      </h1>
      <p className="hero-stats" aria-label="时间轴概览">
        <span>约前2070—1922</span>
        <span>{entityCount} 个条目</span>
        <span>{timelineSectionCount} 个历史阶段</span>
      </p>
    </header>
  );
}
