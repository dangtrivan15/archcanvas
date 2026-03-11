/**
 * Slot-based concurrency guard for test runners.
 *
 * Prevents OOM by limiting how many test processes (Vitest or Playwright)
 * can run simultaneously. Uses filesystem locks (mkdir is atomic) with
 * stale-lock recovery.
 *
 * Two layers of slots:
 *   1. Global pool — caps total concurrent test processes of any type
 *   2. Per-runner pool — caps concurrent processes per runner (vitest / playwright)
 *
 * A test process must acquire both a global slot AND a runner slot before starting.
 *
 * Used as globalSetup in both vitest.config.ts and playwright.config.ts.
 *
 * Config: vitest.config.ts and playwright.config.ts (via test.env / process.env).
 */

import fs from "fs";
import path from "path";

// ── Config ──────────────────────────────────────────────────────────

const PROJECT_DIR = path.resolve(import.meta.dirname, "../..");
const LOCK_DIR = path.join(PROJECT_DIR, "tmp", "locks");
const LOCK_PREFIX = path.join(LOCK_DIR, "archcanvas");

interface PoolConfig {
  name: string;
  prefix: string;
  maxSlots: number;
  envKey: string;
}

const GLOBAL_POOL: PoolConfig = {
  name: "global",
  prefix: `${LOCK_PREFIX}-global.lock`,
  maxSlots: 5,
  envKey: "TEST_SLOTS",
};

const RUNNER_POOLS: Record<string, PoolConfig> = {
  vitest: {
    name: "vitest",
    prefix: `${LOCK_PREFIX}-test.lock`,
    maxSlots: 4,
    envKey: "VITEST_SLOTS",
  },
  playwright: {
    name: "playwright",
    prefix: `${LOCK_PREFIX}-e2e.lock`,
    maxSlots: 2,
    envKey: "PLAYWRIGHT_SLOTS",
  },
};

// ── State ───────────────────────────────────────────────────────────

const acquiredSlots: string[] = [];

// ── Helpers ─────────────────────────────────────────────────────────

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tryAcquireSlot(pool: PoolConfig): string | null {
  for (let i = 0; i < pool.maxSlots; i++) {
    const slotDir = `${pool.prefix}.${i}`;

    try {
      fs.mkdirSync(slotDir);
      fs.writeFileSync(path.join(slotDir, "pid"), process.pid.toString());
      return slotDir;
    } catch {
      // Slot taken — check if stale
    }

    const pidFile = path.join(slotDir, "pid");
    try {
      const ownerPid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
      if (!isNaN(ownerPid) && !isProcessAlive(ownerPid)) {
        fs.rmSync(slotDir, { recursive: true, force: true });
        try {
          fs.mkdirSync(slotDir);
          fs.writeFileSync(path.join(slotDir, "pid"), process.pid.toString());
          return slotDir;
        } catch {
          // Race — move on
        }
      }
    } catch {
      // Can't read PID — move on
    }
  }

  return null;
}

function releaseAll() {
  for (const dir of acquiredSlots) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best effort
    }
  }
  acquiredSlots.length = 0;
}

function resolveMaxSlots(pool: PoolConfig): number {
  const envValue = process.env[pool.envKey];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return pool.maxSlots;
}

async function acquirePool(pool: PoolConfig): Promise<void> {
  const config = { ...pool, maxSlots: resolveMaxSlots(pool) };

  const pollIntervalMs = 2000;
  const timeoutMs = 5 * 60 * 1000;
  const logIntervalMs = 10_000;
  const startTime = Date.now();
  let lastLogTime = 0;

  while (Date.now() - startTime < timeoutMs) {
    const slot = tryAcquireSlot(config);
    if (slot) {
      acquiredSlots.push(slot);
      const waitedMs = Date.now() - startTime;
      if (waitedMs > pollIntervalMs) {
        console.log(
          `[slot-guard] ${config.name} slot acquired after ${Math.round(waitedMs / 1000)}s.`,
        );
      }
      return;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed - lastLogTime >= logIntervalMs || lastLogTime === 0) {
      const waitingSec = Math.round(elapsed / 1000);
      const remainingSec = Math.round((timeoutMs - elapsed) / 1000);
      console.log(
        `[slot-guard] Waiting for ${config.name} slot... ` +
          `(${waitingSec}s elapsed, ${remainingSec}s until timeout, ` +
          `${config.maxSlots} slot(s) in use)`,
      );
      lastLogTime = elapsed;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timed out — release any slots we already acquired
  releaseAll();
  const totalSec = Math.round((Date.now() - startTime) / 1000);
  throw new Error(
    `[slot-guard] Timed out waiting for ${config.name} slot after ${totalSec}s.`,
  );
}

// ── globalSetup / globalTeardown ────────────────────────────────────

export async function setup() {
  const runner =
    process.env.SLOT_GUARD_POOL === "playwright" ? "playwright" : "vitest";

  // Ensure lock directory exists
  fs.mkdirSync(LOCK_DIR, { recursive: true });

  // Acquire global slot first, then runner-specific slot
  await acquirePool(GLOBAL_POOL);
  await acquirePool(RUNNER_POOLS[runner]);

  console.log(`[slot-guard] Starting ${runner} tests.`);

  // Release on unexpected exit
  process.on("exit", releaseAll);
  process.on("SIGINT", () => {
    releaseAll();
    process.exit(1);
  });
  process.on("SIGTERM", () => {
    releaseAll();
    process.exit(1);
  });
}

export async function teardown() {
  releaseAll();
}
