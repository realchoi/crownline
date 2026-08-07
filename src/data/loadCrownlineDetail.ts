import type { CrownlineDetail, CrownlineIndex } from "../domain/types";
import type { FetchData } from "./loadCrownlineIndex";
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

    const request = fetcher(
      `${baseUrl}data/generated/details/${encodeURIComponent(entityId)}.json`
    ).then(async (response) => {
      if (!response.ok) throw new Error(`详情数据请求失败：HTTP ${response.status}`);
      return asCrownlineDetail(await response.json(), entityId);
    });
    cache.set(entityId, request);
    request.catch(() => cache.delete(entityId));
    return request;
  };
}
