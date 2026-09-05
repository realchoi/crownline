import { formatPeriods } from "../domain/chronology";
import {
  CONFIDENCE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
  selectRelatedPolities
} from "../domain/historicalRelationships";
import type { CrownlineDetail, HistoricalEntity } from "../domain/types";
import { EntityLocalName } from "./EntityLocalName";

interface RelatedPolitiesProps {
  entity: HistoricalEntity;
  entities: readonly HistoricalEntity[];
  detail: CrownlineDetail;
  onCompare: (relatedEntityId: string) => void;
}

export function RelatedPolities({ entity, entities, detail, onCompare }: RelatedPolitiesProps) {
  const selection = selectRelatedPolities(entity.id, entities, detail);

  return (
    <section className="detail-section related-polities" aria-labelledby="related-polities-title">
      <h3 id="related-polities-title">相关政权</h3>
      {selection.polities.length > 0 ? (
        <>
          <p className="related-polities-hint">
            列出全时期已校订关系，进入对比查看事件、口径与来源。当前对比选择将替换为这两个政权。
          </p>
          <ul className="related-polities-list">
            {selection.polities.map(({ entity: related, relationships }) => (
              <li className="related-polity" key={related.id}>
                <div>
                  <h4>{related.names.primary}</h4>
                  <EntityLocalName names={related.names} />
                  <ul
                    className="related-polity-records"
                    aria-label={`${related.names.primary}的已校订关系`}
                  >
                    {relationships.map((relationship) => (
                      <li key={relationship.id}>
                        <strong>{RELATIONSHIP_TYPE_LABELS[relationship.type]}</strong>
                        <span>{formatPeriods(relationship.periods)}</span>
                        {(relationship.confidence === "low" ||
                          relationship.confidence === "disputed") && (
                          <span>{CONFIDENCE_LABELS[relationship.confidence]} · 口径见对比</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  className="related-polity-compare"
                  aria-label={`进入对比：${entity.names.primary}与${related.names.primary}`}
                  onClick={() => onCompare(related.id)}
                >
                  进入对比
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="related-polities-hint">
          暂无已校订关系数据。这表示当前数据集尚未收录，不代表历史上没有相关政权或关系。
        </p>
      )}
      {selection.omittedCount > 0 && (
        <p className="related-polities-hint" role="status">
          有 {selection.omittedCount} 条关系数据格式异常，已跳过。
        </p>
      )}
    </section>
  );
}
