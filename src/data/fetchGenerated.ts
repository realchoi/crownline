export type FetchData = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 构建产物目录下某个文件的地址；`baseUrl` 与 Vite `base` 保持一致。 */
export function generatedDataUrl(baseUrl: string, path: string): string {
  return `${baseUrl}data/generated/${path}`;
}

/** 请求生成产物 JSON；非 2xx 响应统一以“请求失败：HTTP n”报错，便于区分网络与校验失败。 */
export async function fetchGeneratedJson(
  fetcher: FetchData,
  url: string,
  label: string
): Promise<unknown> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`${label}请求失败：HTTP ${response.status}`);
  return response.json();
}

/** 合并并发调用并缓存成功结果；失败不进入缓存，下次调用重新请求。 */
export function memoizeSuccessfulLoad<T>(load: () => Promise<T>): () => Promise<T> {
  let successful: { value: T } | undefined;
  let pending: Promise<T> | undefined;

  return () => {
    if (successful) return Promise.resolve(successful.value);
    pending ??= load()
      .then((value) => {
        successful = { value };
        return value;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
