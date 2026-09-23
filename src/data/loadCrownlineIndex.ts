import type { CrownlineIndex } from "../domain/types";
import { fetchGeneratedJson, generatedDataUrl, type FetchData } from "./fetchGenerated";
import { asCrownlineIndex } from "./runtimeValidation";

/** 请求并校验首屏浏览索引。 */
export async function loadCrownlineIndex(
  fetcher: FetchData = fetch,
  baseUrl = import.meta.env.BASE_URL
): Promise<CrownlineIndex> {
  const url = generatedDataUrl(baseUrl, "index.json");
  return asCrownlineIndex(await fetchGeneratedJson(fetcher, url, "首屏数据"));
}
