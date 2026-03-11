/**
 * Browser-compatible key file selector.
 *
 * Same logic as fileSelector.ts but reads file content via
 * FileSystemFileHandle instead of Node.js fs.readFileSync.
 * Produces a KeyFileSet that can be passed to the inference engine.
 */

import type { ScanResult, FileEntry, DirectoryEntry } from './scanner';
import type { ProjectProfile } from './detector';
import type { KeyFileSet, SelectedFile, FileTier, FileSelectionOptions } from './fileSelector';
import { readFileBrowser } from './browserScanner';

// ── Constants ────────────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

// Tier 1: Always include - project-level config and documentation
const TIER1_FILES = new Set([
  'package.json', 'go.mod', 'go.sum', 'Cargo.toml', 'Cargo.lock',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'README.md', 'readme.md', 'README.rst',
  'tsconfig.json', 'pyproject.toml', 'requirements.txt',
  'setup.py', 'setup.cfg', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'Gemfile', 'composer.json', 'mix.exs', 'pubspec.yaml',
  '.env.example', 'Makefile', 'CMakeLists.txt',
  'nx.json', 'turbo.json', 'lerna.json', 'angular.json',
]);

// Tier 2: Entry points
const TIER2_ENTRY_POINTS = new Set([
  'src/index.ts', 'src/index.tsx', 'src/index.js', 'src/index.jsx',
  'src/main.ts', 'src/main.tsx', 'src/main.js',
  'src/app.ts', 'src/app.tsx', 'src/App.tsx', 'src/App.jsx',
  'index.ts', 'index.js', 'main.ts', 'main.js',
  'main.py', 'app.py', 'manage.py', 'main.go', 'cmd/main.go',
  'src/main.rs', 'src/lib.rs',
  'server.ts', 'server.js', 'src/server.ts', 'src/server.js',
]);

const ROUTE_PATTERNS = [
  /routes?\.(ts|js|tsx|jsx|py|rb|go)$/,
  /router\.(ts|js|tsx|jsx)$/,
  /urls\.py$/,
  /routes\.rb$/,
];

const SCHEMA_PATTERNS = [
  /\.proto$/,
  /\.graphql$/, /\.gql$/,
  /openapi\.(ya?ml|json)$/i,
  /swagger\.(ya?ml|json)$/i,
  /schema\.(ts|js|json|prisma|graphql)$/,
  /\.schema\.(ts|js|json)$/,
];

const TIER3_INDEX_PATTERNS = [/^index\.(ts|js|tsx|jsx)$/, /^__init__\.py$/, /^mod\.rs$/];

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectAllFiles(scanResult: ScanResult): FileEntry[] {
  const files: FileEntry[] = [];
  function walkDir(dir: DirectoryEntry) {
    for (const f of dir.files) files.push(f);
    for (const d of dir.directories) walkDir(d);
  }
  walkDir(scanResult.fileTree.root);
  return files;
}

function classifyFile(
  file: FileEntry,
  projectProfile: ProjectProfile,
): { tier: FileTier; reason: string } | null {
  const { name, relativePath } = file;

  if (TIER1_FILES.has(name)) {
    return { tier: 1, reason: `Project config file: ${name}` };
  }
  if (TIER2_ENTRY_POINTS.has(relativePath)) {
    return { tier: 2, reason: `Entry point: ${relativePath}` };
  }
  if (projectProfile.entryPoints.includes(relativePath)) {
    return { tier: 2, reason: `Detected entry point: ${relativePath}` };
  }
  for (const pattern of ROUTE_PATTERNS) {
    if (pattern.test(name) || pattern.test(relativePath)) {
      return { tier: 2, reason: `Route definition: ${relativePath}` };
    }
  }
  for (const pattern of SCHEMA_PATTERNS) {
    if (pattern.test(name) || pattern.test(relativePath)) {
      return { tier: 2, reason: `Schema/API definition: ${relativePath}` };
    }
  }
  for (const pattern of TIER3_INDEX_PATTERNS) {
    if (pattern.test(name)) {
      return { tier: 3, reason: `Module index file: ${relativePath}` };
    }
  }
  return null;
}

function getDirectoryPath(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf('/');
  return lastSlash === -1 ? '.' : relativePath.substring(0, lastSlash);
}

function selectRepresentativeFiles(
  allFiles: FileEntry[],
  alreadySelected: Set<string>,
  maxPerDirectory: number = 2,
): Array<{ file: FileEntry; reason: string }> {
  const dirGroups = new Map<string, FileEntry[]>();
  const sourceExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt',
    '.rb', '.php', '.cs', '.swift', '.scala', '.dart', '.vue', '.svelte',
    '.ex', '.exs', '.clj', '.c', '.cpp', '.h', '.hpp',
  ]);

  for (const file of allFiles) {
    if (alreadySelected.has(file.relativePath)) continue;
    if (!sourceExtensions.has(file.extension)) continue;
    const dir = getDirectoryPath(file.relativePath);
    if (!dirGroups.has(dir)) dirGroups.set(dir, []);
    dirGroups.get(dir)!.push(file);
  }

  const result: Array<{ file: FileEntry; reason: string }> = [];
  for (const [dir, files] of dirGroups) {
    files.sort((a, b) => b.size - a.size);
    const count = Math.min(maxPerDirectory, files.length);
    for (let i = 0; i < count; i++) {
      const file = files[i];
      if (file) {
        result.push({ file, reason: `Representative source file from ${dir}/` });
      }
    }
  }
  return result;
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Browser-compatible version of selectKeyFiles.
 * Reads file content via FileSystemDirectoryHandle instead of Node.js fs.
 *
 * @param scanResult - The filesystem scan result
 * @param projectProfile - The project profile from detector
 * @param dirHandle - FileSystemDirectoryHandle to read files from
 * @param options - Configuration options
 * @returns KeyFileSet with selected files and total token estimate
 */
export async function selectKeyFilesBrowser(
  scanResult: ScanResult,
  projectProfile: ProjectProfile,
  dirHandle: FileSystemDirectoryHandle,
  options: FileSelectionOptions = {},
): Promise<KeyFileSet> {
  const maxLinesPerFile = options.maxLinesPerFile ?? 500;
  const totalTokenBudget = options.totalTokenBudget ?? 100_000;

  const allFiles = collectAllFiles(scanResult);
  const selectedFiles: SelectedFile[] = [];
  const selectedPaths = new Set<string>();
  let currentTokens = 0;

  async function tryAddFile(file: FileEntry, tier: FileTier, reason: string): Promise<boolean> {
    if (selectedPaths.has(file.relativePath)) return true;

    const content = await readFileBrowser(dirHandle, file.relativePath, maxLinesPerFile);
    const tokens = estimateTokens(content);

    if (currentTokens + tokens > totalTokenBudget) {
      return false;
    }

    selectedFiles.push({ path: file.relativePath, content, tier, reason });
    selectedPaths.add(file.relativePath);
    currentTokens += tokens;
    return true;
  }

  // Classify all files into tiers 1-3
  const classified: Array<{ file: FileEntry; tier: FileTier; reason: string }> = [];
  for (const file of allFiles) {
    const classification = classifyFile(file, projectProfile);
    if (classification) {
      classified.push({ file, ...classification });
    }
  }

  // Sort by tier, then by file size
  classified.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.file.size - b.file.size;
  });

  let budgetExceeded = false;

  // Add Tier 1
  for (const item of classified.filter((c) => c.tier === 1)) {
    if (!(await tryAddFile(item.file, item.tier, item.reason))) {
      budgetExceeded = true;
      break;
    }
  }

  // Add Tier 2
  if (!budgetExceeded) {
    for (const item of classified.filter((c) => c.tier === 2)) {
      if (!(await tryAddFile(item.file, item.tier, item.reason))) {
        budgetExceeded = true;
        break;
      }
    }
  }

  // Add Tier 3
  if (!budgetExceeded) {
    for (const item of classified.filter((c) => c.tier === 3)) {
      if (!(await tryAddFile(item.file, item.tier, item.reason))) {
        budgetExceeded = true;
        break;
      }
    }
  }

  // Add Tier 4 representatives
  if (!budgetExceeded) {
    const representatives = selectRepresentativeFiles(allFiles, selectedPaths);
    for (const rep of representatives) {
      if (!(await tryAddFile(rep.file, 4, rep.reason))) {
        break;
      }
    }
  }

  return {
    files: selectedFiles,
    totalTokenEstimate: currentTokens,
  };
}
