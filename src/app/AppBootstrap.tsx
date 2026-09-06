import { useEffect, useState, type ReactNode } from "react";

import type { CrownlineIndex } from "../domain/types";

type BootstrapState =
  | { status: "loading" }
  | { status: "ready"; data: CrownlineIndex }
  | { status: "error"; kind: "network" | "validation" };

interface AppBootstrapProps {
  loadIndex: () => Promise<CrownlineIndex>;
  renderApp: (data: CrownlineIndex) => ReactNode;
}

function classifyFailure(error: unknown): "network" | "validation" {
  if (error instanceof TypeError) return "network";
  const message = error instanceof Error ? error.message : String(error);
  return /请求失败|HTTP\s+\d|failed to fetch|network|网络/iu.test(message)
    ? "network"
    : "validation";
}

/** 负责首屏索引的加载、诊断和用户可恢复的失败状态。 */
export function AppBootstrap({ loadIndex, renderApp }: AppBootstrapProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    void loadIndex()
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error(error);
        setState({ status: "error", kind: classifyFailure(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, loadIndex]);

  if (state.status === "ready") return renderApp(state.data);
  if (state.status === "loading") {
    return (
      <main className="site-shell data-loading" role="status">
        <p>正在加载历史数据…</p>
      </main>
    );
  }

  const networkFailure = state.kind === "network";
  return (
    <main className="site-shell data-error" role="alert">
      <h1>{networkFailure ? "无法加载历史数据" : "历史数据无法读取"}</h1>
      <p>
        {networkFailure
          ? "请检查网络连接后重试。"
          : "收到的数据格式或版本不受支持。请稍后重试；若问题持续，请联系站点维护者。"}
      </p>
      <button className="button" type="button" onClick={() => setAttempt((value) => value + 1)}>
        重新加载
      </button>
    </main>
  );
}
