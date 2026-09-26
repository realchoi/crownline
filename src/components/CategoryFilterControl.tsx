import { useId } from "react";

import { DISPLAY_CATEGORY_NAMES } from "../domain/displayCategories";
import type { CategoryFilter } from "../domain/selectors";
import type { DisplayCategory } from "../domain/types";

interface CategoryFilterControlProps {
  value: CategoryFilter;
  /** 时间轴与年份切片按类别着色，此时色标兼作图例；地图标记不按类别着色，不显示色标。 */
  showSwatches: boolean;
  onChange: (category: CategoryFilter) => void;
}

const CATEGORY_ENTRIES = Object.entries(DISPLAY_CATEGORY_NAMES) as [DisplayCategory, string][];

/** 图例即筛选：单选类别，再次点击已选类别回到全部。 */
export function CategoryFilterControl({
  value,
  showSwatches,
  onChange
}: CategoryFilterControlProps) {
  const labelId = useId();

  return (
    <div
      className={`category-filter${showSwatches ? "" : " is-plain"}${value === "all" ? "" : " has-selection"}`}
      role="group"
      aria-labelledby={labelId}
    >
      <span className="field-label" id={labelId}>
        显示类别
      </span>
      <div className="category-filter-list">
        <button
          className="category-chip category-all"
          type="button"
          aria-pressed={value === "all"}
          onClick={() => onChange("all")}
        >
          全部
        </button>
        {CATEGORY_ENTRIES.map(([category, label]) => (
          <button
            className={`category-chip category-${category}`}
            key={category}
            type="button"
            aria-pressed={value === category}
            onClick={() => onChange(value === category ? "all" : category)}
          >
            {showSwatches && <i className="category-swatch" aria-hidden="true" />}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
