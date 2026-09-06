import { useEffect, useRef } from "react";

import { ComparisonPanel, type ComparisonPanelProps } from "./ComparisonPanel";

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="comparison-dialog"
      aria-labelledby="comparison-title"
      aria-describedby="comparison-dialog-note"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
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
