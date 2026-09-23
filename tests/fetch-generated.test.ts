import { describe, expect, it } from "vitest";

import {
  fetchGeneratedJson,
  generatedDataUrl,
  memoizeSuccessfulLoad
} from "../src/data/fetchGenerated";
import { createDeferred } from "./helpers/renderApp";

describe("生成产物请求", () => {
  it("按站点基准地址拼接产物路径", () => {
    expect(generatedDataUrl("./", "index.json")).toBe("./data/generated/index.json");
    expect(generatedDataUrl("/crownline/", "details/a.json")).toBe(
      "/crownline/data/generated/details/a.json"
    );
  });

  it("非 2xx 响应带上数据名称与状态码", async () => {
    const fetcher = async () => new Response("{}", { status: 404 });
    await expect(fetchGeneratedJson(fetcher, "./x.json", "测试数据")).rejects.toThrow(
      "测试数据请求失败：HTTP 404"
    );
  });

  it("并发调用共享同一请求，成功后不再请求", async () => {
    const deferred = createDeferred<string>();
    let calls = 0;
    const load = memoizeSuccessfulLoad(() => {
      calls += 1;
      return deferred.promise;
    });

    const first = load();
    const second = load();
    deferred.resolve("ok");
    await expect(Promise.all([first, second])).resolves.toEqual(["ok", "ok"]);
    await expect(load()).resolves.toBe("ok");
    expect(calls).toBe(1);
  });

  it("失败不进入缓存，下次调用重新请求", async () => {
    let calls = 0;
    const load = memoizeSuccessfulLoad(async () => {
      calls += 1;
      if (calls === 1) throw new Error("first");
      return "second";
    });

    await expect(load()).rejects.toThrow("first");
    await expect(load()).resolves.toBe("second");
    expect(calls).toBe(2);
  });
});
