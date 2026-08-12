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
      <span aria-hidden="true">{selected ? "已选" : "+ 对比"}</span>
    </button>
  );
}
