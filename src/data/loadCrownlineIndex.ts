import type { CrownlineIndex } from "../domain/types";
import { asCrownlineIndex } from "./runtimeValidation";

export type FetchData = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 请求并校验首屏浏览索引。 */
export async function loadCrownlineIndex(
  fetcher: FetchData = fetch,
  baseUrl = import.meta.env.BASE_URL
): Promise<CrownlineIndex> {
  const response = await fetcher(`${baseUrl}data/generated/index.json`);
  if (!response.ok) throw new Error(`首屏数据请求失败：HTTP ${response.status}`);
  return asCrownlineIndex(await response.json());
}
