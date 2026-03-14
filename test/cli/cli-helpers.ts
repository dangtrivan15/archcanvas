/**
 * Shared helpers for CLI integration tests.
 *
 * Provides `runCLI` (with automatic --project injection), `parseJSON`,
 * YAML fixture templates, and `writeFixture`.
 */
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const execFileAsync = promisify(execFileCb);

export const CLI_PATH = resolve(__dirname, '../../dist/cli.js');

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a CLI command, always injecting `--project <dir>` to prevent
 * `findProjectRoot` from walking up to the real project's .archcanvas/.
 *
 * For `init`, we skip injection (init creates the project, not loads it).
 */
export async function runCLI(args: string[], dir: string): Promise<CLIResult> {
  // Determine the subcommand (skip global flags like --json)
  const subcommand = args.find((a) => !a.startsWith('-') && a !== 'true' && a !== 'false');
  const needsProject = subcommand !== 'init';

  const fullArgs = needsProject && !args.includes('--project')
    ? ['--project', dir, ...args]
    : args;

  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...fullArgs], {
      cwd: dir,
      timeout: 15000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.code ?? 1,
    };
  }
}

/**
 * Parse JSON from CLI output. Handles cases where Node.js warnings
 * (e.g., `(node:XXXX) Warning: ...`) are mixed in before the JSON.
 * Extracts the first `{...}` block from the string.
 */
export function parseJSON(output: string): Record<string, unknown> {
  const trimmed = output.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart === -1) {
    throw new Error(`No JSON found in output: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(jsonStart));
}

// ---------------------------------------------------------------------------
// YAML fixture templates (written directly to skip CLI spawns during setup)
// ---------------------------------------------------------------------------

export const FIXTURES = {
  /** Fresh project — no nodes or edges */
  empty: (name = 'test-project') => `project:
  name: ${name}
  description: ""
  version: 1.0.0
nodes: []
entities: []
edges: []
`,
  /** Project with 1 node (api) */
  oneNode: (name = 'test-project') => `project:
  name: ${name}
  description: ""
  version: 1.0.0
nodes:
  - id: api
    type: compute/service
    displayName: API
entities: []
edges: []
`,
  /** Project with 2 nodes (api + db) and 1 edge */
  twoNodesOneEdge: (name = 'test-project') => `project:
  name: ${name}
  description: ""
  version: 1.0.0
nodes:
  - id: api
    type: compute/service
    displayName: API
  - id: db
    type: data/database
    displayName: DB
entities: []
edges:
  - from:
      node: api
    to:
      node: db
    label: queries
`,
  /** Two nodes, no edges — for add-edge tests */
  twoNodesNoEdge: () => `project:
  name: test-project
  description: ""
  version: 1.0.0
nodes:
  - id: api
    type: compute/service
    displayName: Service
  - id: db
    type: data/database
    displayName: Database
entities: []
edges: []
`,
  /** Project with search-specific data */
  searchData: () => `project:
  name: test-project
  description: ""
  version: 1.0.0
nodes:
  - id: api-gateway
    type: compute/service
    displayName: API Gateway
  - id: user-db
    type: data/database
    displayName: User Database
entities: []
edges:
  - from:
      node: api-gateway
    to:
      node: user-db
    label: queries user data
`,
};

/** Write a fixture YAML into a dir's .archcanvas/ */
export async function writeFixture(dir: string, yaml: string): Promise<void> {
  await mkdir(join(dir, '.archcanvas'), { recursive: true });
  await writeFile(join(dir, '.archcanvas', 'main.yaml'), yaml);
}
