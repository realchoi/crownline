import { formatEntityNameWithLocal } from "../domain/entityNames";
import type { HistoricalEntity } from "../domain/types";

interface ComparisonTrayProps {
  entities: HistoricalEntity[];
  onRemove: (entityId: string) => void;
  onView: () => void;
}

/** 在长结果页中持续提供当前选择和对比弹窗入口。 */
export function ComparisonTray({ entities, onRemove, onView }: ComparisonTrayProps) {
  return (
    <aside className="comparison-tray" aria-label="对比快捷栏">
      <div className="comparison-tray-frame">
        <p className="comparison-tray-status" role="status" aria-live="polite">
          <span>政权对比</span>
          <strong>已选 {entities.length}/2</strong>
        </p>

        <ul className="comparison-tray-entities" aria-label="快捷栏中的对比政权">
          {entities.map((entity) => (
            <li key={entity.id}>
              <span title={entity.names.primary}>{entity.names.primary}</span>
              <button
                type="button"
                aria-label={`从对比快捷栏移除${formatEntityNameWithLocal(entity.names)}`}
                onClick={() => onRemove(entity.id)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
          {entities.length === 1 && <li className="is-empty">再选一个政权</li>}
        </ul>

        <button
          className="comparison-tray-view"
          type="button"
          aria-haspopup="dialog"
          onClick={onView}
        >
          查看对比
        </button>
      </div>
    </aside>
  );
}
