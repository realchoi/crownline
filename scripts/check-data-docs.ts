import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadSourceData } from "./data-source";
import type { CrownlineData } from "../src/domain/types";

export const DATA_STATS_START = "<!-- crownline-data-stats:start -->";
export const DATA_STATS_END = "<!-- crownline-data-stats:end -->";

export interface CurrentDataStats {
  entities: number;
  polities: number;
  historicalPeriods: number;
  persons: number;
  reigns: number;
  relationships: number;
  events: number;
  geographicSnapshots: number;
  boundarySnapshots: number;
  sources: number;
}

export const CURRENT_DATA_DOCUMENTS = ["README.md", "docs/data-contract.md", "ROADMAP.md"] as const;

export function buildCurrentDataStats(data: CrownlineData): CurrentDataStats {
  return {
    entities: data.entities.length,
    polities: data.entities.filter(({ entityKind }) => entityKind === "polity").length,
    historicalPeriods: data.entities.filter(({ entityKind }) => entityKind === "historical-period")
      .length,
    persons: data.persons.length,
    reigns: data.reigns.length,
    relationships: data.relationships.length,
    events: data.events.length,
    geographicSnapshots: data.geographicSnapshots.length,
    boundarySnapshots: data.boundarySnapshots.length,
    sources: data.sources.length
  };
}

export function renderCurrentDataStatsBlock(data: CrownlineData): string {
  const stats = buildCurrentDataStats(data);
  return [
    DATA_STATS_START,
    `当前数据快照：${stats.entities} 个实体（${stats.polities} 个政权、${stats.historicalPeriods} 个历史分期）、${stats.persons} 位人物、${stats.reigns} 条任期、${stats.relationships} 条结构化关系、${stats.events} 个事件、${stats.geographicSnapshots} 条地理快照、${stats.boundarySnapshots} 条疆域快照、${stats.sources} 项来源。`,
    DATA_STATS_END
  ].join("\n");
}

function expectedFields(stats: CurrentDataStats): string {
  return [
    `entities=${stats.entities}`,
    `polities=${stats.polities}`,
    `historicalPeriods=${stats.historicalPeriods}`,
    `persons=${stats.persons}`,
    `reigns=${stats.reigns}`,
    `relationships=${stats.relationships}`,
    `events=${stats.events}`,
    `geographicSnapshots=${stats.geographicSnapshots}`,
    `boundarySnapshots=${stats.boundarySnapshots}`,
    `sources=${stats.sources}`
  ].join(", ");
}

export function checkDataDocument(path: string, contents: string, data: CrownlineData): string[] {
  const start = contents.indexOf(DATA_STATS_START);
  const end = contents.indexOf(DATA_STATS_END);
  const expected = renderCurrentDataStatsBlock(data);
  if (start < 0 || end < 0 || end < start) {
    return [`文件 ${path} 缺少完整当前数据摘要区块（${DATA_STATS_START} … ${DATA_STATS_END}）`];
  }
  const actual = contents.slice(start, end + DATA_STATS_END.length);
  const normalizedActual = actual
    .replace(`${DATA_STATS_START}\n\n`, `${DATA_STATS_START}\n`)
    .replace(`\n\n${DATA_STATS_END}`, `\n${DATA_STATS_END}`);
  if (normalizedActual === expected) return [];
  return [
    `文件 ${path} 当前数据摘要不一致；期望字段：${expectedFields(buildCurrentDataStats(data))}`
  ];
}

export async function checkDataDocs(root = process.cwd(), data?: CrownlineData): Promise<string[]> {
  const sourceData = data ?? (await loadSourceData());
  const issues: string[] = [];
  await Promise.all(
    CURRENT_DATA_DOCUMENTS.map(async (relativePath) => {
      const path = join(root, relativePath);
      let contents: string;
      try {
        contents = await readFile(path, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        issues.push(`无法读取文档 ${path}：${message}`);
        return;
      }
      issues.push(...checkDataDocument(relativePath, contents, sourceData));
    })
  );
  return issues.sort((left, right) => left.localeCompare(right, "en"));
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  const data = await loadSourceData();
  const issues = await checkDataDocs(process.cwd(), data);
  if (issues.length > 0) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("当前数据文档摘要一致。");
  }
}
