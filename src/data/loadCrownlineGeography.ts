import type { FetchData } from "./loadCrownlineIndex";
import { asCrownlineGeography, type GeographyLoadResult } from "./runtimeValidation";

export type { GeographyLoadResult } from "./runtimeValidation";
export type CrownlineGeographyLoader = () => Promise<GeographyLoadResult>;

/** 首次进入地图时，从相对于当前文档的稳定地址加载独立地理数据。 */
export async function loadGeneratedGeography(
  fetcher: FetchData = fetch
): Promise<GeographyLoadResult> {
  const url = new URL("./data/generated/geography.json", document.baseURI);
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`无法加载地理数据（HTTP ${response.status}）`);
  return asCrownlineGeography(await response.json());
}
