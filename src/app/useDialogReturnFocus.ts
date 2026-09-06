import { useLayoutEffect, useRef, type RefObject } from "react";

/** 详情与对比互相切换时保留同一个浏览起点，最后关闭时才恢复。 */
export function useDialogReturnFocus(isOpen: boolean, mainRef: RefObject<HTMLElement | null>) {
  const origin = useRef<{ element: HTMLElement | null; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (isOpen) {
      origin.current ??= {
        element: document.activeElement instanceof HTMLElement ? document.activeElement : null,
        x: window.scrollX,
        y: window.scrollY
      };
      return;
    }
    if (!origin.current) return;
    const frame = requestAnimationFrame(() => {
      const previous = origin.current;
      origin.current = null;
      if (!previous) return;
      const trigger = previous.element;
      // 清空对比后快捷栏会消失；深链接也可能没有可恢复的触发按钮。
      const target =
        trigger?.isConnected && trigger !== document.body
          ? trigger
          : (document.querySelector<HTMLButtonElement>(".comparison-tray-view") ?? mainRef.current);
      target?.focus({ preventScroll: true });
      if (window.scrollX !== previous.x || window.scrollY !== previous.y) {
        window.scrollTo({ left: previous.x, top: previous.y, behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, mainRef]);
}
