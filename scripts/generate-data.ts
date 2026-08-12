import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildGeneratedArtifacts } from "../src/data/artifacts";
import { validateCrownlineData } from "../src/domain/dataValidation";
import { loadSourceData } from "./data-source";

export interface GenerateDataOptions {
  sourceRoot?: string;
  toolOutputRoot?: string;
  publicOutputRoot?: string;
}

export interface GeneratedDataSummary {
  sections: number;
  entities: number;
  persons: number;
  reigns: number;
  geographicSnapshots: number;
  details: number;
  sources: number;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createStagingDirectory(target: string): Promise<string> {
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  return mkdtemp(join(parent, `.${basename(target)}.tmp-`));
}

async function replaceDirectory(staging: string, target: string): Promise<void> {
  await rm(target, { recursive: true, force: true });
  await rename(staging, target);
}

/** 聚合、全量校验并生成工具数据和浏览器运行时数据。 */
export async function generateData(options: GenerateDataOptions = {}): Promise<GeneratedDataSummary> {
  const sourceRoot = resolve(options.sourceRoot ?? join(process.cwd(), "src", "data", "source"));
  const toolOutputRoot = resolve(
    options.toolOutputRoot ?? join(process.cwd(), ".generated", "data")
  );
  const publicOutputRoot = resolve(
    options.publicOutputRoot ?? join(process.cwd(), "public", "data", "generated")
  );
  const data = await loadSourceData(sourceRoot);
  const validation = validateCrownlineData(data);
  if (!validation.valid) {
    const details = validation.issues
      .map((issue) => `[${issue.code}] ${issue.path} ${issue.message}`)
      .join("\n");
    throw new Error(`历史数据校验失败：\n${details}`);
  }

  const artifacts = buildGeneratedArtifacts(data);
  const toolStaging = await createStagingDirectory(toolOutputRoot);
  const publicStaging = await createStagingDirectory(publicOutputRoot);
  try {
    await writeJson(join(toolStaging, "crownline-data.json"), data);
    await writeJson(join(publicStaging, "index.json"), artifacts.index);
    await writeJson(join(publicStaging, "geography.json"), artifacts.geography);
    await Promise.all(Array.from(artifacts.details, ([entityId, detail]) => {
      return writeJson(join(publicStaging, "details", `${entityId}.json`), detail);
    }));
    await replaceDirectory(toolStaging, toolOutputRoot);
    await replaceDirectory(publicStaging, publicOutputRoot);
  } catch (error) {
    await Promise.all([
      rm(toolStaging, { recursive: true, force: true }),
      rm(publicStaging, { recursive: true, force: true })
    ]);
    throw error;
  }

  return {
    sections: data.timelineSections.length,
    entities: data.entities.length,
    persons: data.persons.length,
    reigns: data.reigns.length,
    geographicSnapshots: data.geographicSnapshots.length,
    details: artifacts.details.size,
    sources: data.sources.length
  };
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  generateData()
    .then((summary) => {
      console.log(
        `数据生成完成：${summary.sections} 个阶段，${summary.entities} 个实体，` +
        `${summary.persons} 个人物，${summary.reigns} 条任期，` +
        `${summary.geographicSnapshots} 条地理快照，${summary.details} 个详情包，` +
        `${summary.sources} 个来源`
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
