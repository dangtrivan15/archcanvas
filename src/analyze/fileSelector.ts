/**
 * Key File Selector and Content Extractor
 *
 * Intelligently selects the most architecturally significant files from a scan
 * result and project profile. Extracts file content with smart truncation to
 * control AI token usage and analysis quality.
 *
 * Priority tiers:
 *   Tier 1 (always include): package.json, go.mod, Cargo.toml, Dockerfile,
 *           docker-compose.yml, README.md, config files
 *   Tier 2 (high value): entry points, route definitions, schema files
 *   Tier 3 (structural): module index files, barrel exports, __init__.py
 *   Tier 4 (representative): sample source files from each major directory
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ScanResult, FileEntry, DirectoryEntry } from './scanner';
import type { ProjectProfile } from './detector';

// ── Types ────────────────────────────────────────────────────────────────────

export type FileTier = 1 | 2 | 3 | 4;

export interface SelectedFile {
  path: string;
  content: string;
  tier: FileTier;
  reason: string;
}

export interface KeyFileSet {
  files: SelectedFile[];
  totalTokenEstimate: number;
}

export interface FileSelectionOptions {
  /** Maximum number of lines to read per file (default: 500) */
  maxLinesPerFile?: number;
  /** Total token budget across all files (default: 100000) */
  totalTokenBudget?: number;
  /** Root directory for reading file contents (default: process.cwd()) */
  rootDir?: string;
  /** If true, skip actual file content reading (for testing) */
  skipContentRead?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Approximate characters per token (conservative estimate) */
const CHARS_PER_TOKEN = 4;

// Tier 1: Always include - project-level config and documentation
const TIER1_FILES = new Set([
  'package.json',
  'go.mod',
  'go.sum',
  'Cargo.toml',
  'Cargo.lock',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'README.md',
  'readme.md',
  'README.rst',
  'tsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'setup.cfg',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
  'composer.json',
  'mix.exs',
  'pubspec.yaml',
  '.env.example',
  'Makefile',
  'CMakeLists.txt',
  'nx.json',
  'turbo.json',
  'lerna.json',
  'angular.json',
]);

// Tier 2: High value - entry points, routes, schemas
const TIER2_ENTRY_POINTS = new Set([
  'src/index.ts',
  'src/index.tsx',
  'src/index.js',
  'src/index.jsx',
  'src/main.ts',
  'src/main.tsx',
  'src/main.js',
  'src/app.ts',
  'src/app.tsx',
  'src/App.tsx',
  'src/App.jsx',
  'index.ts',
  'index.js',
  'main.ts',
  'main.js',
  'main.py',
  'app.py',
  'manage.py',
  'main.go',
  'cmd/main.go',
  'src/main.rs',
  'src/lib.rs',
  'server.ts',
  'server.js',
  'src/server.ts',
  'src/server.js',
]);

/** File name patterns for route definitions */
const ROUTE_PATTERNS = [
  /routes?\.(ts|js|tsx|jsx|py|rb|go)$/,
  /router\.(ts|js|tsx|jsx)$/,
  /urls\.py$/,
  /routes\.rb$/,
];

/** File name patterns for schema/API definition files */
const SCHEMA_PATTERNS = [
  /\.proto$/,
  /\.graphql$/,
  /\.gql$/,
  /openapi\.(ya?ml|json)$/i,
  /swagger\.(ya?ml|json)$/i,
  /schema\.(ts|js|json|prisma|graphql)$/,
  /\.schema\.(ts|js|json)$/,
];

// Tier 3: Structural - index/barrel files
const TIER3_INDEX_PATTERNS = [
  /^index\.(ts|js|tsx|jsx)$/,
  /^__init__\.py$/,
  /^mod\.rs$/,
];

// ── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Collect all FileEntry objects from a ScanResult, flattened.
 */
function collectAllFiles(scanResult: ScanResult): FileEntry[] {
  const files: FileEntry[] = [];

  function walkDir(dir: DirectoryEntry) {
    for (const f of dir.files) {
      files.push(f);
    }
    for (const d of dir.directories) {
      walkDir(d);
    }
  }

  walkDir(scanResult.fileTree.root);
  return files;
}

/**
 * Classify a file into its priority tier and reason for selection.
 * Returns null if the file doesn't match any tier criteria.
 */
function classifyFile(
  file: FileEntry,
  projectProfile: ProjectProfile,
): { tier: FileTier; reason: string } | null {
  const { name, relativePath } = file;

  // Tier 1: Config and documentation files
  if (TIER1_FILES.has(name)) {
    return { tier: 1, reason: `Project config file: ${name}` };
  }

  // Tier 2: Entry points
  if (TIER2_ENTRY_POINTS.has(relativePath)) {
    return { tier: 2, reason: `Entry point: ${relativePath}` };
  }

  // Also check detected entry points from the project profile
  if (projectProfile.entryPoints.includes(relativePath)) {
    return { tier: 2, reason: `Detected entry point: ${relativePath}` };
  }

  // Tier 2: Route definitions
  for (const pattern of ROUTE_PATTERNS) {
    if (pattern.test(name) || pattern.test(relativePath)) {
      return { tier: 2, reason: `Route definition: ${relativePath}` };
    }
  }

  // Tier 2: Schema files
  for (const pattern of SCHEMA_PATTERNS) {
    if (pattern.test(name) || pattern.test(relativePath)) {
      return { tier: 2, reason: `Schema/API definition: ${relativePath}` };
    }
  }

  // Tier 3: Index/barrel files (but not already matched as entry points)
  for (const pattern of TIER3_INDEX_PATTERNS) {
    if (pattern.test(name)) {
      return { tier: 3, reason: `Module index file: ${relativePath}` };
    }
  }

  return null;
}

/**
 * Get the directory depth of a relative path (e.g., "src/utils/helpers.ts" = 2).
 */
function getDirectoryPath(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf('/');
  return lastSlash === -1 ? '.' : relativePath.substring(0, lastSlash);
}

/**
 * Select representative sample files from directories not yet covered (Tier 4).
 * Picks 1-2 files per major directory.
 */
function selectRepresentativeFiles(
  allFiles: FileEntry[],
  alreadySelected: Set<string>,
  maxPerDirectory: number = 2,
): Array<{ file: FileEntry; reason: string }> {
  // Group unselected source files by directory
  const dirGroups = new Map<string, FileEntry[]>();

  const sourceExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
    '.kt', '.rb', '.php', '.cs', '.swift', '.scala', '.dart',
    '.vue', '.svelte', '.ex', '.exs', '.clj', '.c', '.cpp', '.h', '.hpp',
  ]);

  for (const file of allFiles) {
    if (alreadySelected.has(file.relativePath)) continue;
    if (!sourceExtensions.has(file.extension)) continue;

    const dir = getDirectoryPath(file.relativePath);
    if (!dirGroups.has(dir)) {
      dirGroups.set(dir, []);
    }
    dirGroups.get(dir)!.push(file);
  }

  const result: Array<{ file: FileEntry; reason: string }> = [];

  for (const [dir, files] of dirGroups) {
    // Sort by size descending (larger files tend to be more architecturally significant)
    files.sort((a, b) => b.size - a.size);

    const count = Math.min(maxPerDirectory, files.length);
    for (let i = 0; i < count; i++) {
      result.push({
        file: files[i],
        reason: `Representative source file from ${dir}/`,
      });
    }
  }

  return result;
}

/**
 * Read file content with smart truncation.
 * Prioritizes top-of-file (imports, declarations) and truncates after maxLines.
 */
function readFileContent(
  filePath: string,
  maxLines: number,
): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (lines.length <= maxLines) {
      return content;
    }

    // Take the first maxLines lines and add a truncation notice
    const truncated = lines.slice(0, maxLines).join('\n');
    const remainingLines = lines.length - maxLines;
    return truncated + `\n\n// ... truncated (${remainingLines} more lines)`;
  } catch {
    return '// [File could not be read]';
  }
}

/**
 * Estimate token count from a string (characters / CHARS_PER_TOKEN).
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Select the most architecturally significant files from a scan result
 * and project profile. Extracts content with smart truncation.
 *
 * @param scanResult - The filesystem scan result from scanner.ts
 * @param projectProfile - The project profile from detector.ts
 * @param options - Configuration options
 * @returns KeyFileSet with selected files and total token estimate
 */
export function selectKeyFiles(
  scanResult: ScanResult,
  projectProfile: ProjectProfile,
  options: FileSelectionOptions = {},
): KeyFileSet {
  const maxLinesPerFile = options.maxLinesPerFile ?? 500;
  const totalTokenBudget = options.totalTokenBudget ?? 100_000;
  const rootDir = options.rootDir ?? process.cwd();
  const skipContentRead = options.skipContentRead ?? false;

  const allFiles = collectAllFiles(scanResult);
  const selectedFiles: SelectedFile[] = [];
  const selectedPaths = new Set<string>();
  let currentTokens = 0;

  /**
   * Try to add a file to the selection if within budget.
   * Returns true if added, false if budget exceeded.
   */
  function tryAddFile(
    file: FileEntry,
    tier: FileTier,
    reason: string,
  ): boolean {
    if (selectedPaths.has(file.relativePath)) return true; // already selected

    let content: string;
    if (skipContentRead) {
      content = `// Content of ${file.relativePath}`;
    } else {
      const fullPath = path.join(rootDir, file.relativePath);
      content = readFileContent(fullPath, maxLinesPerFile);
    }

    const tokens = estimateTokens(content);

    if (currentTokens + tokens > totalTokenBudget) {
      return false; // budget exceeded
    }

    selectedFiles.push({
      path: file.relativePath,
      content,
      tier,
      reason,
    });
    selectedPaths.add(file.relativePath);
    currentTokens += tokens;
    return true;
  }

  // Phase 1: Classify all files into tiers 1-3
  const classified: Array<{ file: FileEntry; tier: FileTier; reason: string }> = [];

  for (const file of allFiles) {
    const classification = classifyFile(file, projectProfile);
    if (classification) {
      classified.push({ file, ...classification });
    }
  }

  // Sort by tier (1 first), then by file size (smaller config files first within tier)
  classified.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.file.size - b.file.size;
  });

  // Phase 2: Add files tier by tier, respecting budget
  let budgetExceeded = false;

  // Add Tier 1
  for (const item of classified.filter(c => c.tier === 1)) {
    if (!tryAddFile(item.file, item.tier, item.reason)) {
      budgetExceeded = true;
      break;
    }
  }

  // Add Tier 2
  if (!budgetExceeded) {
    for (const item of classified.filter(c => c.tier === 2)) {
      if (!tryAddFile(item.file, item.tier, item.reason)) {
        budgetExceeded = true;
        break;
      }
    }
  }

  // Add Tier 3
  if (!budgetExceeded) {
    for (const item of classified.filter(c => c.tier === 3)) {
      if (!tryAddFile(item.file, item.tier, item.reason)) {
        budgetExceeded = true;
        break;
      }
    }
  }

  // Phase 3: Add Tier 4 representative files
  if (!budgetExceeded) {
    const representatives = selectRepresentativeFiles(allFiles, selectedPaths);
    for (const rep of representatives) {
      if (!tryAddFile(rep.file, 4, rep.reason)) {
        break; // budget exceeded
      }
    }
  }

  return {
    files: selectedFiles,
    totalTokenEstimate: currentTokens,
  };
}
