import { open, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const RECOVERY_LOCK_PATH =
  process.env.SMART_ERD_E2E_RECOVERY_LOCK_PATH ??
  path.join(os.tmpdir(), 'smart-erd-e2e-recovery.lock');

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireRecoveryLock(timeoutMs: number): Promise<() => Promise<void>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const handle = await open(RECOVERY_LOCK_PATH, 'wx');
      await handle.writeFile(String(process.pid));
      return async () => {
        await handle.close();
        await unlink(RECOVERY_LOCK_PATH).catch(() => undefined);
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for recovery test lock: ${RECOVERY_LOCK_PATH}`);
}

export async function withDiagramRecoveryLock<T>(
  run: () => Promise<T>,
  timeoutMs = 120_000,
): Promise<T> {
  const release = await acquireRecoveryLock(timeoutMs);
  try {
    return await run();
  } finally {
    await release();
  }
}
