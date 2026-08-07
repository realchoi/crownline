import type { CrownlineDetail } from "../domain/types";

export type DetailLoadState =
  | { status: "loading" }
  | { status: "ready"; detail: CrownlineDetail }
  | { status: "missing" }
  | { status: "error"; message: string };

interface DetailLoadPanelProps {
  state: DetailLoadState;
  onRetry: () => void;
}

/** 在详情主体内呈现按需加载、失败重试和无数据状态。 */
export function DetailLoadPanel({ state, onRetry }: DetailLoadPanelProps) {
  if (state.status === "ready") return null;
  if (state.status === "error") {
    return (
      <section className="detail-section detail-load-error" role="alert">
        <strong>详情加载失败</strong>
        <p>{state.message}</p>
        <button className="button detail-retry" type="button" onClick={onRetry}>
          重新加载
        </button>
      </section>
    );
  }
  return (
    <section className="detail-section detail-loading" role="status">
      <p>{state.status === "loading" ? "正在加载详情" : "暂无已整理详情"}</p>
    </section>
  );
}
