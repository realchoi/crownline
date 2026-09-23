import { useEffect, useRef, type RefObject } from "react";

interface ModalDialogOptions {
  /** 常驻挂载的对话框用它控制开关；随组件挂载即打开的对话框可省略。 */
  open?: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  '[tabindex]:not([tabindex="-1"])'
].join(", ");

/** 让 Tab / Shift+Tab 在对话框首尾可见可聚焦元素之间循环。 */
function wrapTabFocus(dialog: HTMLDialogElement, event: KeyboardEvent) {
  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0
  );
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

/**
 * 原生模态对话框的统一生命周期：打开（不支持 showModal 时退化为 open 属性）、初始聚焦、
 * Escape 与 cancel 走同一关闭回调、Tab 循环，以及关闭或卸载时收起。
 * 焦点归还由调用方负责（详情/对比用 useDialogReturnFocus，筛选抽屉回到触发按钮）。
 */
export function useModalDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  { open = true, onClose, initialFocusRef }: ModalDialogOptions
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    initialFocusRef?.current?.focus({ preventScroll: true });

    // 监听 document，保证焦点意外落在 body 时 Escape 仍走统一关闭流程。
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        wrapTabFocus(dialog, event);
      }
    };
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      dialog.removeEventListener("cancel", handleCancel);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [dialogRef, initialFocusRef, open]);
}
