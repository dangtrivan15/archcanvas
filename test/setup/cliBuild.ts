/**
 * Global setup for CLI integration tests.
 *
 * Builds `dist/cli.js` once before all CLI test files run.
 * This avoids each test file rebuilding the CLI independently
 * (which would race on the same output file).
 */
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFileCb);

export async function setup() {
  const projectRoot = resolve(import.meta.dirname, '../..');
  const cliPath = resolve(projectRoot, 'dist/cli.js');

  await execFileAsync('npx', ['vite', 'build', '--config', 'vite.config.cli.ts'], {
    cwd: projectRoot,
  });

  if (!existsSync(cliPath)) {
    throw new Error(`CLI build failed: ${cliPath} not found`);
  }

  console.log('[cli-build] dist/cli.js built successfully.');
}
