import { useCallback, useEffect, useRef, useState } from "react";

export type LazyResourceState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: T }
  | { status: "error"; message: string };

/**
 * 只在 enabled 时按需加载单个资源。
 * 成功结果在停用后仍被复用；停用时丢弃进行中的请求，迟到的成功或失败都不会写回。
 */
export function useLazyResource<T>(enabled: boolean, load: () => Promise<T>) {
  const [state, setState] = useState<LazyResourceState<T>>({ status: "idle" });
  const requestSequenceRef = useRef(0);
  const successfulRef = useRef<{ result: T } | null>(null);

  const retry = useCallback(() => {
    if (successfulRef.current) {
      setState({ status: "ready", result: successfulRef.current.result });
      return;
    }
    const requestSequence = ++requestSequenceRef.current;
    setState({ status: "loading" });
    void load()
      .then((result) => {
        if (requestSequence !== requestSequenceRef.current) return;
        successfulRef.current = { result };
        setState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (requestSequence !== requestSequenceRef.current) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error)
        });
      });
  }, [load]);

  useEffect(() => {
    if (enabled && state.status === "idle") {
      retry();
      return;
    }
    if (!enabled && state.status === "loading") {
      requestSequenceRef.current += 1;
      setState(
        successfulRef.current
          ? { status: "ready", result: successfulRef.current.result }
          : { status: "idle" }
      );
    }
  }, [enabled, retry, state.status]);

  return { state, retry };
}
