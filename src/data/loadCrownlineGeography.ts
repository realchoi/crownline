import {
  fetchGeneratedJson,
  generatedDataUrl,
  memoizeSuccessfulLoad,
  type FetchData
} from "./fetchGenerated";
import { asCrownlineGeography, type GeographyLoadResult } from "./runtimeValidation";

export type { GeographyLoadResult } from "./runtimeValidation";
export type CrownlineGeographyLoader = () => Promise<GeographyLoadResult>;

/** 创建首次进入地图时使用的地理数据加载器：合并并发请求、缓存成功结果、失败可重试。 */
export function createCrownlineGeographyLoader(
  fetcher: FetchData = fetch,
  baseUrl = import.meta.env.BASE_URL
): CrownlineGeographyLoader {
  const url = generatedDataUrl(baseUrl, "geography.json");
  return memoizeSuccessfulLoad(async () => {
    return asCrownlineGeography(await fetchGeneratedJson(fetcher, url, "地理数据"));
  });
}

/** 不带实例缓存的一次性加载。 */
export function loadGeneratedGeography(
  fetcher: FetchData = fetch,
  baseUrl = import.meta.env.BASE_URL
): Promise<GeographyLoadResult> {
  return createCrownlineGeographyLoader(fetcher, baseUrl)();
}
