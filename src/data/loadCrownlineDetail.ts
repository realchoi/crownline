import type { CrownlineDetail, CrownlineIndex } from "../domain/types";
import { fetchGeneratedJson, generatedDataUrl, type FetchData } from "./fetchGenerated";
import { asCrownlineDetail } from "./runtimeValidation";

export type CrownlineDetailLoader = (entityId: string) => Promise<CrownlineDetail | null>;

/** 为一个索引创建带并发合并和成功缓存的详情加载器。 */
export function createCrownlineDetailLoader(
  index: CrownlineIndex,
  fetcher: FetchData = fetch,
  baseUrl = import.meta.env.BASE_URL
): CrownlineDetailLoader {
  const availableIds = new Set(index.detailEntityIds);
  const cache = new Map<string, Promise<CrownlineDetail>>();

  return async (entityId) => {
    if (!availableIds.has(entityId)) return null;
    const cached = cache.get(entityId);
    if (cached) return cached;

    const url = generatedDataUrl(baseUrl, `details/${encodeURIComponent(entityId)}.json`);
    const request = fetchGeneratedJson(fetcher, url, "详情数据").then((json) =>
      asCrownlineDetail(json, entityId)
    );
    cache.set(entityId, request);
    request.catch(() => cache.delete(entityId));
    return request;
  };
}
