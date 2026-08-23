import type { CrownlineBoundaries } from "../domain/types";
import type { FetchData } from "./loadCrownlineIndex";
import { asCrownlineBoundaries, type BoundaryLoadResult } from "./runtimeValidation";

export type { BoundaryLoadResult } from "./runtimeValidation";
export type CrownlineBoundariesLoader = () => Promise<BoundaryLoadResult>;

/** 创建带成功缓存和并发合并的疆域数据加载器；失败请求会从缓存中移除以便重试。 */
export function createCrownlineBoundariesLoader(
  fetcher: FetchData = fetch
): CrownlineBoundariesLoader {
  let successful: BoundaryLoadResult | undefined;
  let pending: Promise<BoundaryLoadResult> | undefined;

  return () => {
    if (successful) return Promise.resolve(successful);
    if (pending) return pending;

    const url = new URL("./data/generated/boundaries.json", document.baseURI);
    pending = fetcher(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`疆域数据请求失败：HTTP ${response.status}`);
        const result = asCrownlineBoundaries(await response.json());
        successful = result;
        return result;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}

/** 默认运行时加载器；应用入口使用工厂以获得实例级缓存。 */
export function loadGeneratedBoundaries(fetcher: FetchData = fetch): Promise<BoundaryLoadResult> {
  return createCrownlineBoundariesLoader(fetcher)();
}

export type { CrownlineBoundaries };
