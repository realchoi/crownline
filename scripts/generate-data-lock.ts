import { constants } from "node:fs";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const LOCK_FILE_NAME = ".generate-data.lock";
const POLL_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLockPid(lockPath: string): Promise<number | null> {
  try {
    const pid = Number.parseInt((await readFile(lockPath, "utf8")).trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function removeStaleLock(lockPath: string): Promise<void> {
  const pid = await readLockPid(lockPath);
  if (pid === null || pid === process.pid || !isProcessAlive(pid)) {
    await unlink(lockPath).catch(() => {});
  }
}

/** 串行化并发生成，避免多个进程同时替换同一输出目录。 */
export async function withGenerateDataLock<T>(
  lockRoot: string,
  fn: () => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const lockPath = join(lockRoot, LOCK_FILE_NAME);
  await mkdir(lockRoot, { recursive: true });
  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      const handle = await open(
        lockPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY
      );
      await handle.writeFile(String(process.pid));
      await handle.close();
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error(`等待数据生成锁超时（${lockPath}）`);
      }
      await removeStaleLock(lockPath);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  try {
    return await fn();
  } finally {
    await unlink(lockPath).catch(() => {});
  }
}
