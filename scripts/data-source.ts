import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";

import type { CrownlineData } from "../src/domain/types";

interface EntityFragment {
  order: number;
  entities: CrownlineData["entities"];
  persons: CrownlineData["persons"];
  reigns: CrownlineData["reigns"];
  reignVacancies: CrownlineData["reignVacancies"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取数据文件 ${path}：${message}`);
  }
}

async function listJsonFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return listJsonFiles(path);
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    })
  );
  return nested.flat().sort((left, right) => {
    const leftPath = relative(root, left).split(sep).join("/");
    const rightPath = relative(root, right).split(sep).join("/");
    return leftPath.localeCompare(rightPath, "en");
  });
}

async function readArrayFiles<T>(root: string, label: string): Promise<T[]> {
  const files = await listJsonFiles(root);
  const arrays = await Promise.all(
    files.map(async (path) => {
      const value = await readJson(path);
      if (!Array.isArray(value)) throw new Error(`${label} 文件必须是数组：${path}`);
      return value as T[];
    })
  );
  return arrays.flat();
}

function parseEntityFragment(value: unknown, path: string): EntityFragment {
  if (!isRecord(value)) throw new Error(`实体分片必须是对象：${path}`);
  if (!Number.isSafeInteger(value.order) || Number(value.order) <= 0) {
    throw new Error(`实体分片 order 必须是正整数：${path}`);
  }
  for (const key of ["entities", "persons", "reigns", "reignVacancies"] as const) {
    if (!Array.isArray(value[key])) throw new Error(`实体分片 ${key} 必须是数组：${path}`);
  }
  const entities = value.entities as unknown[];
  if (entities.length !== 1 || !isRecord(entities[0])) {
    throw new Error(`实体分片必须且只能包含一个主实体：${path}`);
  }
  const entityId = entities[0].id;
  const filename = basename(path, ".json");
  if (typeof entityId !== "string" || filename !== entityId) {
    throw new Error(`实体分片文件名必须与主实体 ID 一致：${path}`);
  }
  return value as unknown as EntityFragment;
}

/** 从可维护的源分片恢复现有完整数据契约。 */
export async function loadSourceData(
  sourceRoot = join(process.cwd(), "src", "data", "source")
): Promise<CrownlineData> {
  const core = await readJson(join(sourceRoot, "core.json"));
  if (!isRecord(core)) throw new Error("core.json 必须是对象");

  const fragmentPaths = await listJsonFiles(join(sourceRoot, "entities"));
  const fragments = await Promise.all(
    fragmentPaths.map(async (path) => {
      return parseEntityFragment(await readJson(path), path);
    })
  );
  const firstPathByOrder = new Map<number, string>();
  fragments.forEach((fragment, index) => {
    const previous = firstPathByOrder.get(fragment.order);
    if (previous) {
      throw new Error(
        `实体分片 order ${fragment.order} 重复：${previous} 与 ${fragmentPaths[index]}`
      );
    }
    firstPathByOrder.set(fragment.order, fragmentPaths[index]!);
  });
  fragments.sort((left, right) => left.order - right.order);

  return {
    schemaVersion: core.schemaVersion as CrownlineData["schemaVersion"],
    chronologyPolicy: core.chronologyPolicy as CrownlineData["chronologyPolicy"],
    timelineSections: await readArrayFiles(join(sourceRoot, "timeline-sections"), "阶段"),
    entities: fragments.flatMap(({ entities }) => entities),
    regions: await readArrayFiles(join(sourceRoot, "regions"), "地区"),
    persons: fragments.flatMap(({ persons }) => persons),
    reigns: fragments.flatMap(({ reigns }) => reigns),
    reignVacancies: fragments.flatMap(({ reignVacancies }) => reignVacancies),
    relationships: await readArrayFiles(join(sourceRoot, "relationships"), "关系"),
    events: await readArrayFiles(join(sourceRoot, "events"), "事件"),
    geographicSnapshots: await readArrayFiles(join(sourceRoot, "geography"), "地理快照"),
    boundarySnapshots: await readArrayFiles(join(sourceRoot, "boundaries"), "疆域快照"),
    sources: await readArrayFiles(join(sourceRoot, "sources"), "来源")
  };
}
