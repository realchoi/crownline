import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadSourceData } from "../scripts/data-source";
import { buildGeneratedArtifacts } from "../src/data/artifacts";
import {
  asCrownlineGeography,
  validateCrownlineDetail,
  validateCrownlineIndex
} from "../src/data/runtimeValidation";
import { CROWNLINE_SCHEMA_VERSION } from "../src/domain/types";

const artifacts = buildGeneratedArtifacts(await loadSourceData());
const schema = JSON.parse(
  readFileSync(join(process.cwd(), "src/data/crownline-data.schema.json"), "utf8")
) as { properties: { schemaVersion: { const: number } } };

describe("生成产物与浏览器运行时契约一致性", () => {
  it("生成器产生的 index、全部 detail 和 geography 均通过窄校验", () => {
    expect(validateCrownlineIndex(artifacts.index)).toEqual({ valid: true, issues: [] });
    artifacts.details.forEach((detail, entityId) => {
      expect(validateCrownlineDetail(detail, entityId)).toEqual({ valid: true, issues: [] });
    });
    expect(asCrownlineGeography(artifacts.geography)).toEqual({
      geography: artifacts.geography,
      omittedCount: 0
    });
  });

  it.each([
    ["entityKind"],
    ["displayCategory"],
    ["existencePeriods"],
    ["historicalRegionIds"],
    ["description"],
    ["confidence"]
  ] as const)("索引实体删除 UI 必需字段 %s 时拒绝", (field) => {
    const broken = structuredClone(artifacts.index) as unknown as {
      entities: Record<string, unknown>[];
    };
    Reflect.deleteProperty(broken.entities[0]!, field);

    expect(validateCrownlineIndex(broken).valid).toBe(false);
  });

  it("详情核心记录删除 UI 必需字段时拒绝", () => {
    const detail = structuredClone(artifacts.details.get("polity-cn-tang")!);
    Reflect.deleteProperty(detail.reigns[0]!, "role");

    expect(validateCrownlineDetail(detail, "polity-cn-tang").issues).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_ERROR", path: "/reigns/0/role" })
    );
  });

  it("本地名称与有效 BCP 47 标签必须成对", () => {
    const withLocalName = artifacts.index.entities.find(({ names }) => names.local);
    if (!withLocalName) throw new Error("测试数据缺少本地名称");

    const missingLocal = structuredClone(artifacts.index);
    const missingLocalEntity = missingLocal.entities.find(({ id }) => id === withLocalName.id)!;
    Reflect.deleteProperty(missingLocalEntity.names, "local");
    expect(validateCrownlineIndex(missingLocal).valid).toBe(false);

    const invalidTag = structuredClone(artifacts.index);
    invalidTag.entities.find(({ id }) => id === withLocalName.id)!.names.localLanguageTag = "auto";
    expect(validateCrownlineIndex(invalidTag).valid).toBe(false);
  });

  it("Schema、TypeScript 版本常量、生成产物与运行时支持版本必须同步", () => {
    expect(schema.properties.schemaVersion.const).toBe(CROWNLINE_SCHEMA_VERSION);
    expect(artifacts.index.schemaVersion).toBe(CROWNLINE_SCHEMA_VERSION);
    expect(artifacts.geography.schemaVersion).toBe(CROWNLINE_SCHEMA_VERSION);
    artifacts.details.forEach((detail) => {
      expect(detail.schemaVersion).toBe(CROWNLINE_SCHEMA_VERSION);
    });

    const futureVersion = structuredClone(artifacts.index) as unknown as Record<string, unknown>;
    futureVersion.schemaVersion = CROWNLINE_SCHEMA_VERSION + 1;
    expect(validateCrownlineIndex(futureVersion).valid).toBe(false);
  });
});
