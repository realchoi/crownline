import type { CategoryFilter } from "../domain/selectors";
import type { DisplayCategory } from "../domain/types";

/** 展示类别对应的中文界面名称。 */
export const DISPLAY_CATEGORY_NAMES: Record<DisplayCategory, string> = {
  mainline: "主线王朝",
  contemporary: "主要并立政权",
  context: "历史分期",
  regional: "区域政权"
};

/** 筛选面板的受控状态与事件。 */
interface FilterPanelProps {
  query: string;
  category: CategoryFilter;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onClear: () => void;
}

/** 渲染搜索、类别筛选、清除按钮和类别图例。 */
export function FilterPanel({
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onClear
}: FilterPanelProps) {
  const hasFilters = query.trim().length > 0 || category !== "all";

  return (
    <section className="controls-panel" aria-label="时间轴筛选工具">
      <div className="controls-grid">
        <label>
          <span className="field-label">搜索名称、别名、年份或说明</span>
          <input
            className="text-input"
            type="search"
            placeholder="例如：唐、北魏、南宋、前221"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className="field-label">显示类别</span>
          <select
            className="select-input"
            value={category}
            onChange={(event) => onCategoryChange(event.currentTarget.value as CategoryFilter)}
          >
            <option value="all">全部条目</option>
            {Object.entries(DISPLAY_CATEGORY_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="button" disabled={!hasFilters} onClick={onClear}>
          清除筛选
        </button>
      </div>
      <div className="legend" aria-label="类别图例">
        {Object.entries(DISPLAY_CATEGORY_NAMES).map(([value, label]) => (
          <span className={`legend-item legend-${value}`} key={value}>
            <i className="legend-mark" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
