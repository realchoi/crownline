import { useRef } from "react";

import { ComparisonPanel, type ComparisonPanelProps } from "./ComparisonPanel";
import { useModalDialog } from "./useModalDialog";

interface ComparisonDialogProps extends ComparisonPanelProps {
  onClose: () => void;
  onClear: () => void;
  onReturnToDetail?: () => void;
}

/** 固定标题和退出入口，只允许内容区滚动；关闭后仍保留当前选择。 */
export function ComparisonDialog({
  onClose,
  onClear,
  onReturnToDetail,
  ...panelProps
}: ComparisonDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useModalDialog(dialogRef, { onClose, initialFocusRef: closeRef });

  return (
    <dialog
      ref={dialogRef}
      className="comparison-dialog"
      aria-labelledby="comparison-title"
      aria-describedby="comparison-dialog-note"
    >
      <div className="comparison-dialog-shell">
        <header className="comparison-dialog-head">
          <div>
            <p className="comparison-kicker">时间与历史关系</p>
            <h2 id="comparison-title">政权时间对比</h2>
            <p id="comparison-dialog-note">关闭后保留已选政权，继续浏览。</p>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            aria-label="关闭对比"
            onClick={onClose}
          />
        </header>
        <div className="comparison-dialog-actions">
          {onReturnToDetail && (
            <button className="comparison-clear" type="button" onClick={onReturnToDetail}>
              返回详情
            </button>
          )}
          <button className="comparison-clear" type="button" onClick={onClear}>
            清空对比
          </button>
        </div>
        <div className="comparison-dialog-body">
          <ComparisonPanel
            {...panelProps}
            onRemove={(entityId) => {
              panelProps.onRemove(entityId);
              closeRef.current?.focus({ preventScroll: true });
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
