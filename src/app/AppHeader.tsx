interface AppHeaderProps {
  entityCount: number;
  timelineSectionCount: number;
}

/** Static product introduction and generated-data totals. */
export function AppHeader({ entityCount, timelineSectionCount }: AppHeaderProps) {
  return (
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
          <strong className="stat-value">约前2070—1922</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">收录条目</span>
          <strong className="stat-value">{entityCount} 个</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">历史阶段</span>
          <strong className="stat-value">{timelineSectionCount} 个</strong>
        </div>
      </div>
    </header>
  );
}
