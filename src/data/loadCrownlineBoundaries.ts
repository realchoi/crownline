import type { CrownlineBoundaries } from "../domain/types";
import {
  fetchGeneratedJson,
  generatedDataUrl,
  memoizeSuccessfulLoad,
  type FetchData
} from "./fetchGenerated";
import { asCrownlineBoundaries, type BoundaryLoadResult } from "./runtimeValidation";

export type { BoundaryLoadResult } from "./runtimeValidation";
export type CrownlineBoundariesLoader = () => Promise<BoundaryLoadResult>;

/** 创建疆域图层加载器：合并并发请求、缓存成功结果、失败可重试。 */
export function createCrownlineBoundariesLoader(
  fetcher: FetchData = fetch,
  baseUrl = import.meta.env.BASE_URL
): CrownlineBoundariesLoader {
  const url = generatedDataUrl(baseUrl, "boundaries.json");
  return memoizeSuccessfulLoad(async () => {
    return asCrownlineBoundaries(await fetchGeneratedJson(fetcher, url, "疆域数据"));
  });
}

/** 不带实例缓存的一次性加载。 */
export function loadGeneratedBoundaries(
  fetcher: FetchData = fetch,
  baseUrl = import.meta.env.BASE_URL
): Promise<BoundaryLoadResult> {
  return createCrownlineBoundariesLoader(fetcher, baseUrl)();
}

export type { CrownlineBoundaries };
