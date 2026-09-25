import { useEffect, type RefObject } from "react";

const OFFSET_PROPERTY = "--sticky-header-offset";

/**
 * 把当前吸顶工具条占据的视口高度写入根元素 CSS 变量，
 * 让时间轴坐标轴等次级吸顶元素停在它下方；工具条缺席时移除变量。
 */
export function useStickyHeaderOffset(
  headerRef: RefObject<HTMLElement | null>,
  active: boolean,
  stickyTop = 0
): void {
  useEffect(() => {
    const header = headerRef.current;
    const root = document.documentElement;
    if (!active || !header) {
      root.style.removeProperty(OFFSET_PROPERTY);
      return;
    }

    const sync = () => {
      root.style.setProperty(OFFSET_PROPERTY, `${stickyTop + header.offsetHeight}px`);
    };
    sync();
    if (typeof ResizeObserver === "undefined") {
      return () => root.style.removeProperty(OFFSET_PROPERTY);
    }
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty(OFFSET_PROPERTY);
    };
  }, [active, headerRef, stickyTop]);
}
