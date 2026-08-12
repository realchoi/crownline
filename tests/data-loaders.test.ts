import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import { createCrownlineDetailLoader } from "../src/data/loadCrownlineDetail";
import { loadCrownlineIndex } from "../src/data/loadCrownlineIndex";
import {
  validateCrownlineDetail,
  validateCrownlineIndex
} from "../src/data/runtimeValidation";
import type { CrownlineDetail, CrownlineIndex } from "../src/domain/types";

const artifacts = buildGeneratedArtifacts(await loadSourceData());
const index = artifacts.index;
const tangDetail = artifacts.details.get("polity-cn-tang");
if (!tangDetail) throw new Error("缺少唐详情测试数据");

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("运行时数据校验", () => {
  it("接受生成器产生的索引和详情", () => {
    expect(validateCrownlineIndex(index)).toEqual({ valid: true, issues: [] });
    expect(validateCrownlineDetail(tangDetail, "polity-cn-tang")).toEqual({
      valid: true,
      issues: []
    });
  });

  it("拒绝阶段引用不存在实体的索引", () => {
    const broken: CrownlineIndex = structuredClone(index);
    broken.timelineSections[0]?.entityIds.push("polity-missing");

    expect(validateCrownlineIndex(broken).issues).toContainEqual(
      expect.objectContaining({ code: "DANGLING_ENTITY_REF" })
    );
  });

  it("拒绝缺少页面必需字段的索引记录", () => {
    const broken: CrownlineIndex = structuredClone(index);
    const firstEntity = broken.entities[0];
    if (!firstEntity) throw new Error("索引缺少测试实体");
    Reflect.deleteProperty(firstEntity, "names");

    expect(validateCrownlineIndex(broken).issues).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_ERROR", path: "/entities/0/names" })
    );
  });

  it("拒绝响应实体与请求实体不一致的详情", () => {
    expect(validateCrownlineDetail(tangDetail, "polity-cn-sui").issues).toContainEqual(
      expect.objectContaining({ code: "DETAIL_ENTITY_MISMATCH" })
    );
  });

  it("拒绝人物或来源引用不闭合的详情", () => {
    const missingPerson: CrownlineDetail = structuredClone(tangDetail);
    missingPerson.persons = missingPerson.persons.slice(1);
    expect(validateCrownlineDetail(missingPerson, "polity-cn-tang").issues).toContainEqual(
      expect.objectContaining({ code: "DANGLING_PERSON_REF" })
    );

    const missingSource: CrownlineDetail = structuredClone(tangDetail);
    const referencedSourceId = missingSource.reigns[0]?.sourceRefs[0]?.sourceId;
    if (!referencedSourceId) throw new Error("测试任期缺少来源引用");
    missingSource.sources = missingSource.sources.filter(({ id }) => id !== referencedSourceId);
    expect(validateCrownlineDetail(missingSource, "polity-cn-tang").issues).toContainEqual(
      expect.objectContaining({ code: "DANGLING_SOURCE_REF" })
    );
  });

  it("拒绝缺少页面必需字段的详情记录", () => {
    const broken: CrownlineDetail = structuredClone(tangDetail);
    const firstPerson = broken.persons[0];
    if (!firstPerson) throw new Error("详情缺少测试人物");
    Reflect.deleteProperty(firstPerson, "names");

    expect(validateCrownlineDetail(broken, "polity-cn-tang").issues).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_ERROR", path: "/persons/0/names" })
    );
  });

  it("把单条关系或事件留给领域层隔离", () => {
    const broken: CrownlineDetail = structuredClone(tangDetail);
    broken.relationships.push({ broken: true } as never);
    broken.events.push({ id: 42 } as never);

    expect(validateCrownlineDetail(broken, "polity-cn-tang")).toEqual({
      valid: true,
      issues: []
    });
  });

  it.each(["relationships", "events"] as const)("仍拒绝非数组的%s根字段", (key) => {
    const broken = structuredClone(tangDetail) as unknown as Record<string, unknown>;
    broken[key] = { broken: true };

    expect(validateCrownlineDetail(broken, "polity-cn-tang").issues).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_ERROR", path: `/${key}` })
    );
  });
});

describe("运行时数据加载", () => {
  it("加载并校验首屏索引", async () => {
    const urls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return jsonResponse(index);
    };

    await expect(loadCrownlineIndex(fetcher, "./")).resolves.toEqual(index);
    expect(urls).toEqual(["./data/generated/index.json"]);
  });

  it("合并同一实体的并发请求并缓存成功结果", async () => {
    const urls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return jsonResponse(tangDetail);
    };
    const loadDetail = createCrownlineDetailLoader(index, fetcher, "./");

    const [first, second] = await Promise.all([
      loadDetail("polity-cn-tang"),
      loadDetail("polity-cn-tang")
    ]);
    const third = await loadDetail("polity-cn-tang");

    expect(first).toEqual(tangDetail);
    expect(second).toEqual(tangDetail);
    expect(third).toEqual(tangDetail);
    expect(urls).toEqual(["./data/generated/details/polity-cn-tang.json"]);
  });

  it("失败请求不进入缓存并允许下次重试", async () => {
    let attempts = 0;
    const fetcher = async () => {
      attempts += 1;
      return attempts === 1 ? jsonResponse({ message: "broken" }, 500) : jsonResponse(tangDetail);
    };
    const loadDetail = createCrownlineDetailLoader(index, fetcher, "./");

    await expect(loadDetail("polity-cn-tang")).rejects.toThrow("详情数据请求失败");
    await expect(loadDetail("polity-cn-tang")).resolves.toEqual(tangDetail);
    expect(attempts).toBe(2);
  });

  it("索引未声明的实体不发起请求", async () => {
    let requested = false;
    const loadDetail = createCrownlineDetailLoader(index, async () => {
      requested = true;
      return jsonResponse({});
    }, "./");

    await expect(loadDetail("polity-not-indexed")).resolves.toBeNull();
    expect(requested).toBe(false);
  });
});
