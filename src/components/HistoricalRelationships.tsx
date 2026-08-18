import { formatPeriods } from "../domain/chronology";
import {
  CONFIDENCE_LABELS,
  selectHistoricalRelationships,
  type ResolvedHistoricalRelationship
} from "../domain/historicalRelationships";
import type { CrownlineDetail, HistoricalEntity } from "../domain/types";

interface HistoricalRelationshipsProps {
  left: HistoricalEntity;
  right: HistoricalEntity;
  details: readonly CrownlineDetail[];
}

function RelationshipRecord({
  record,
  entities
}: {
  record: ResolvedHistoricalRelationship;
  entities: readonly HistoricalEntity[];
}) {
  const { relationship, events, sources } = record;
  return (
    <article className="relationship-card">
      <div className="relationship-meta">
        <strong>{formatPeriods(relationship.periods)}</strong>
        <span className={`relationship-confidence is-${relationship.confidence}`}>
          {CONFIDENCE_LABELS[relationship.confidence]}
        </span>
      </div>

      <ul className="relationship-participants" aria-label="关系参与方">
        {relationship.participants.map(({ entityId, role }) => {
          const entity = entities.find(({ id }) => id === entityId);
          return (
            <li key={entityId}>
              <strong>{entity?.names.primary ?? entityId}</strong>
              <span> · {role}</span>
            </li>
          );
        })}
      </ul>

      <p className="relationship-summary">{relationship.summary}</p>
      {relationship.confidenceNote && (
        <aside className="relationship-note">
          <strong>口径与争议</strong>
          <p>{relationship.confidenceNote}</p>
        </aside>
      )}

      {events.length > 0 && (
        <div className="relationship-events">
          <strong>相关事件</strong>
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <span>{formatPeriods(event.periods)}</span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="relationship-sources">
        <summary>来源 · {sources.length} 项</summary>
        <ul>
          {sources.map(({ ref, source }) => (
            <li key={`${relationship.id}-${source.id}`}>
              <cite>{source.citation}</cite>
              {(ref.locator || ref.note) && (
                <small>{[ref.locator, ref.note].filter(Boolean).join("；")}</small>
              )}
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`查看来源：${source.title}`}
                >
                  查看来源
                </a>
              )}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

/** 展示人工校订、可追溯且已通过逐条收窄的政权间历史关系。 */
export function HistoricalRelationships({ left, right, details }: HistoricalRelationshipsProps) {
  const selection = selectHistoricalRelationships(left.id, right.id, details);
  const relationshipCount = selection.groups.reduce((count, group) => {
    return count + group.relationships.length;
  }, 0);

  return (
    <section className="historical-relationships" aria-labelledby="historical-relationships-title">
      <header className="historical-relationships-heading">
        <div>
          <p>阶段 4B · 人工校订</p>
          <h3 id="historical-relationships-title">已校订历史关系</h3>
          <span>与上方自动计算的时间关系分开呈现</span>
        </div>
        {relationshipCount > 0 && (
          <strong>
            {relationshipCount} 条记录 · {selection.groups.length} 种类型
          </strong>
        )}
      </header>

      {selection.groups.length > 0 ? (
        <div className="relationship-groups">
          {selection.groups.map((group) => {
            const titleId = `relationship-group-${group.type}`;
            return (
              <section
                className={`relationship-group is-${group.type}`}
                aria-labelledby={titleId}
                key={group.type}
              >
                <h4 id={titleId}>{group.label}</h4>
                <div>
                  {group.relationships.map((relationship) => (
                    <RelationshipRecord
                      record={relationship}
                      entities={[left, right]}
                      key={relationship.relationship.id}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="relationship-empty">
          <strong>暂无已校订关系数据</strong>
          <p>这表示当前数据集尚未收录，不代表双方历史上没有关系。</p>
        </div>
      )}

      {selection.omittedCount > 0 && (
        <p className="relationship-warning" role="status">
          有 {selection.omittedCount} 条关系数据格式异常，已跳过。
        </p>
      )}
    </section>
  );
}
