interface ComparisonToggleProps {
  entityName: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/** 不改变详情点击行为的独立政权对比选择按钮。 */
export function ComparisonToggle({
  entityName,
  selected,
  disabled,
  onToggle
}: ComparisonToggleProps) {
  return (
    <button
      className={`comparison-toggle${selected ? " is-selected" : ""}`}
      type="button"
      aria-label={`将${entityName}${selected ? "移出" : "加入"}对比`}
      aria-pressed={selected}
      disabled={disabled && !selected}
      onClick={onToggle}
    >
      <span className="comparison-toggle-text" aria-hidden="true">
        {selected ? "已选" : "+ 对比"}
      </span>
      {/* 手机时间轴行改用图标；SVG 不依赖字体子集。 */}
      <svg
        className="comparison-toggle-icon"
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <path d={selected ? "M3 8.5l3.2 3.2L13 4.8" : "M8 3v10M3 8h10"} />
      </svg>
    </button>
  );
}
