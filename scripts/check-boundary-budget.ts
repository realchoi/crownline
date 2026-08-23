import { gzipSync } from "node:zlib";

import { buildGeneratedArtifacts } from "../src/data/artifacts";
import { loadSourceData } from "./data-source";

export const BOUNDARY_BUDGET = {
  rawBytes: 500_000,
  gzipBytes: 150_000,
  totalPositions: 1_200,
  maxPositionsPerSnapshot: 180,
  maxSnapshots: 10
} as const;

function countPositions(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  if (value.length === 2 && value.every((item) => typeof item === "number")) return 1;
  return value.reduce((total, item) => total + countPositions(item), 0);
}

export async function checkBoundaryBudget() {
  const artifacts = buildGeneratedArtifacts(await loadSourceData());
  const serialized = `${JSON.stringify(artifacts.boundaries, null, 2)}\n`;
  const rawBytes = Buffer.byteLength(serialized, "utf8");
  const gzipBytes = gzipSync(serialized).byteLength;
  const positionsBySnapshot = artifacts.boundaries.boundarySnapshots.map(({ geometry }) =>
    countPositions(geometry.coordinates)
  );
  const totalPositions = positionsBySnapshot.reduce((total, count) => total + count, 0);
  const maxPositionsPerSnapshot = Math.max(0, ...positionsBySnapshot);
  const summary = {
    rawBytes,
    gzipBytes,
    totalPositions,
    maxPositionsPerSnapshot,
    snapshots: positionsBySnapshot.length
  };
  const violations = [
    rawBytes > BOUNDARY_BUDGET.rawBytes && `rawBytes=${rawBytes} > ${BOUNDARY_BUDGET.rawBytes}`,
    gzipBytes > BOUNDARY_BUDGET.gzipBytes &&
      `gzipBytes=${gzipBytes} > ${BOUNDARY_BUDGET.gzipBytes}`,
    totalPositions > BOUNDARY_BUDGET.totalPositions &&
      `totalPositions=${totalPositions} > ${BOUNDARY_BUDGET.totalPositions}`,
    maxPositionsPerSnapshot > BOUNDARY_BUDGET.maxPositionsPerSnapshot &&
      `maxPositionsPerSnapshot=${maxPositionsPerSnapshot} > ${BOUNDARY_BUDGET.maxPositionsPerSnapshot}`,
    positionsBySnapshot.length > BOUNDARY_BUDGET.maxSnapshots &&
      `snapshots=${positionsBySnapshot.length} > ${BOUNDARY_BUDGET.maxSnapshots}`
  ].filter((value): value is string => Boolean(value));
  if (violations.length > 0) {
    throw new Error(`疆域性能预算超限：\n${violations.join("\n")}`);
  }
  console.log(
    `疆域预算通过：${rawBytes} B 原始，${gzipBytes} B gzip，${totalPositions} 个坐标位置，` +
      `单快照最多 ${maxPositionsPerSnapshot} 个，${positionsBySnapshot.length} 条快照`
  );
  return summary;
}

const entryPath = process.argv[1];
if (entryPath?.endsWith("check-boundary-budget.ts")) {
  checkBoundaryBudget().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
