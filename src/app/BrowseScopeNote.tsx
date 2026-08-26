import type { RegionScope } from "../domain/regionScope";

interface BrowseScopeNoteProps {
  regionScope: RegionScope;
}

/** 当前观测范围的数据口径；与结果摘要组成稳定的范围说明区。 */
export function BrowseScopeNote({ regionScope }: BrowseScopeNoteProps) {
  return (
    <details className="scope-note">
      <summary>
        <span className="scope-icon" aria-hidden="true">
          注
        </span>
        <span>方法与收录说明</span>
        <span className="scope-summary-hint">数据覆盖、范围与空结果口径</span>
      </summary>
      <p>
        {regionScope.mode === "china"
          ? "“所有朝代”并不存在完全统一的学术边界。中国范围采用通史常见口径：覆盖主线王朝、分裂时期的主要政权，并补充少量重要区域政权；不把每一个地方割据、农民政权或短暂称帝政权都列为独立“朝代”。"
          : "跨地区内容目前只用于验证地区机制，每个外部地区仅有少量代表条目。“全球已收录”表示当前数据集中的全部内容，不表示世界历史已经完整覆盖；空结果也不表示该地区当时没有政权。"}
      </p>
    </details>
  );
}
