import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { loadSourceData } from "../scripts/data-source";
import { generateData } from "../scripts/generate-data";
import type { CrownlineData } from "../src/domain/types";

const data: CrownlineData = await loadSourceData();
const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "crownline-data-source-"));
  temporaryRoots.push(root);
  return root;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeSourceTree(root: string, value: CrownlineData = data): Promise<string[]> {
  await writeJson(join(root, "core.json"), {
    schemaVersion: value.schemaVersion,
    chronologyPolicy: value.chronologyPolicy
  });
  await writeJson(join(root, "timeline-sections", "china.json"), value.timelineSections);
  await writeJson(join(root, "regions", "regions.json"), value.regions);
  await writeJson(join(root, "sources", "sources.json"), value.sources);
  await writeJson(join(root, "relationships", "relationships.json"), value.relationships);
  await writeJson(join(root, "events", "events.json"), value.events);

  const sectionEntityIds = new Set(value.timelineSections.flatMap(({ entityIds }) => entityIds));
  const firstPolityByPersonId = new Map<string, string>();
  value.reigns.forEach(({ personId, polityId }) => {
    if (!firstPolityByPersonId.has(personId)) firstPolityByPersonId.set(personId, polityId);
  });
  const paths: string[] = [];
  for (const [index, entity] of value.entities.entries()) {
    const directory = sectionEntityIds.has(entity.id) ? "china" : "world";
    const path = join(root, "entities", directory, `${entity.id}.json`);
    paths.push(path);
    await writeJson(path, {
      order: (index + 1) * 10,
      entities: [entity],
      persons: value.persons.filter(({ id }) => firstPolityByPersonId.get(id) === entity.id),
      reigns: value.reigns.filter(({ polityId }) => polityId === entity.id),
      reignVacancies: value.reignVacancies.filter(({ polityId }) => polityId === entity.id)
    });
  }
  return paths;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("源数据分片", () => {
  it("按显式顺序无损聚合完整数据", async () => {
    const sourceRoot = await createTemporaryRoot();
    await writeSourceTree(sourceRoot);

    expect(await loadSourceData(sourceRoot)).toEqual(data);
  });

  it("拒绝文件名与主实体 ID 不一致的分片", async () => {
    const sourceRoot = await createTemporaryRoot();
    const [firstPath] = await writeSourceTree(sourceRoot);
    if (!firstPath) throw new Error("测试分片缺失");
    await rename(firstPath, join(firstPath, "..", `wrong-${basename(firstPath)}`));

    await expect(loadSourceData(sourceRoot)).rejects.toThrow("文件名必须与主实体 ID 一致");
  });

  it("拒绝重复的实体顺序", async () => {
    const sourceRoot = await createTemporaryRoot();
    const [, secondPath] = await writeSourceTree(sourceRoot);
    if (!secondPath) throw new Error("测试分片不足");
    const fragment = (await readJson(secondPath)) as Record<string, unknown>;
    await writeJson(secondPath, { ...fragment, order: 10 });

    await expect(loadSourceData(sourceRoot)).rejects.toThrow("order 10 重复");
  });

  it("生成完整工具数据、首屏索引和实体详情", async () => {
    const root = await createTemporaryRoot();
    const sourceRoot = join(root, "source");
    const toolOutputRoot = join(root, "tool-output");
    const publicOutputRoot = join(root, "public-output");
    await writeSourceTree(sourceRoot);

    const summary = await generateData({ sourceRoot, toolOutputRoot, publicOutputRoot });

    expect(summary).toMatchObject({ entities: 77, persons: 675, reigns: 706, details: 77 });
    expect(await readJson(join(toolOutputRoot, "crownline-data.json"))).toEqual(data);
    expect(await readJson(join(publicOutputRoot, "index.json"))).toMatchObject({
      schemaVersion: 3
    });
    expect(await readJson(join(publicOutputRoot, "details", "polity-cn-tang.json"))).toMatchObject({
      entityId: "polity-cn-tang"
    });
  });

  it("坏数据不会替换上一套公开产物", async () => {
    const root = await createTemporaryRoot();
    const sourceRoot = join(root, "source");
    const toolOutputRoot = join(root, "tool-output");
    const publicOutputRoot = join(root, "public-output");
    await writeSourceTree(sourceRoot);
    await writeJson(join(publicOutputRoot, "sentinel.json"), { stable: true });
    await writeJson(join(sourceRoot, "core.json"), {
      schemaVersion: 2,
      chronologyPolicy: data.chronologyPolicy
    });

    await expect(generateData({ sourceRoot, toolOutputRoot, publicOutputRoot })).rejects.toThrow(
      "历史数据校验失败"
    );
    expect(await readJson(join(publicOutputRoot, "sentinel.json"))).toEqual({ stable: true });
  });
});
