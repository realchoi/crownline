import { useEffect, useRef } from "react";

import { calculatePeriodsDuration, formatPeriods } from "../domain/chronology";
import type { HistoricalEntity, Region } from "../domain/types";
import { DISPLAY_CATEGORY_NAMES } from "./FilterPanel";

/** 详情对话框展示的实体、阶段和关闭事件。 */
interface DetailDialogProps {
  entity: HistoricalEntity;
  sectionTitle: string | undefined;
  regions: Region[];
  onClose: () => void;
}

/** 渲染实体完整区间、口径说明和累计持续时间。 */
export function DetailDialog({ entity, sectionTitle, regions, onClose }: DetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const duration = calculatePeriodsDuration(entity.existencePeriods);
  const regionNames = entity.historicalRegionIds.flatMap((regionId) => {
    const region = regions.find(({ id }) => id === regionId);
    return region ? [region.names.primary] : [];
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // 浏览器使用原生模态能力；测试环境不支持时退化为 open 属性。
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    closeButtonRef.current?.focus();
    // 显式监听 Escape，确保不同浏览器和自动化环境都走统一关闭流程。
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="detail-name"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => event.currentTarget === event.target && onClose()}
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <div>
            <span className={`type-badge detail-${entity.displayCategory}`}>
              {DISPLAY_CATEGORY_NAMES[entity.displayCategory]}
            </span>
            <h2 className="dialog-title" id="detail-name">
              {entity.names.primary}
            </h2>
            <p className="dialog-years">
              {formatPeriods(entity.existencePeriods, entity.displayRangeOverride)}
            </p>
          </div>
          <button
            className="icon-button"
            ref={closeButtonRef}
            type="button"
            aria-label="关闭详情"
            onClick={onClose}
          />
        </div>
        <p>{entity.description}</p>
        {entity.chronologyNote && <p className="chronology-note">采用口径：{entity.chronologyNote}</p>}
        <div className="detail-grid">
          <div className="detail-card">
            <span>{sectionTitle ? "阶段" : "历史地区"}</span>
            <strong>{sectionTitle ?? regionNames.join("、")}</strong>
          </div>
          <div className="detail-card">
            <span>持续时间</span>
            <strong>{duration > 1 ? `约 ${duration} 年` : "不足 1 年"}</strong>
          </div>
        </div>
      </div>
    </dialog>
  );
}
