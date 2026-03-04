import { describe, it, expect } from 'vitest';
import {
  selectKeyFiles,
  type KeyFileSet,
  type FileSelectionOptions,
  type FileTier,
} from '../../../src/analyze/fileSelector';
import type { ScanResult, FileEntry, DirectoryEntry } from '../../../src/analyze/scanner';
import type { ProjectProfile } from '../../../src/analyze/detector';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(relativePath: string, size = 100): FileEntry {
  const parts = relativePath.split('/');
  const name = parts[parts.length - 1];
  const ext = name.includes('.') ? '.' + name.split('.').pop()! : '';
  return {
    name,
    relativePath,
    size,
    extension: ext.toLowerCase(),
    lastModified: Date.now(),
  };
}

function makeDir(
  name: string,
  relativePath: string,
  files: FileEntry[] = [],
  directories: DirectoryEntry[] = [],
): DirectoryEntry {
  return { name, relativePath, files, directories };
}

function makeScanResult(opts: {
  rootFiles?: string[];
  nestedFiles?: string[];
  rootDirs?: DirectoryEntry[];
}): ScanResult {
  const rootFileEntries = (opts.rootFiles ?? []).map(f => makeFile(f));
  const nestedFileEntries = (opts.nestedFiles ?? []).map(f => makeFile(f));

  // Build language breakdown
  const languageBreakdown: Record<string, number> = {};
  const allFileEntries = [...rootFileEntries, ...nestedFileEntries];
  for (const f of allFileEntries) {
    const key = f.extension || '(no extension)';
    languageBreakdown[key] = (languageBreakdown[key] ?? 0) + 1;
  }

  // Build nested directory structure from nestedFiles
  const nestedDirs = new Map<string, DirectoryEntry>();
  for (const f of nestedFileEntries) {
    const parts = f.relativePath.split('/');
    if (parts.length > 1) {
      const dirPath = parts.slice(0, -1).join('/');
      const dirName = parts[parts.length - 2];
      if (!nestedDirs.has(dirPath)) {
        nestedDirs.set(dirPath, makeDir(dirName, dirPath));
      }
      nestedDirs.get(dirPath)!.files.push(f);
    }
  }

  const rootDirs = opts.rootDirs ?? Array.from(nestedDirs.values());

  return {
    fileTree: {
      root: {
        name: 'root',
        relativePath: '.',
        files: rootFileEntries,
        directories: rootDirs,
      },
    },
    totalFiles: allFileEntries.length,
    totalDirs: rootDirs.length,
    languageBreakdown,
  };
}

function makeProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    languages: [],
    frameworks: [],
    projectType: 'single-app',
    buildSystems: [],
    infraSignals: [],
    dataStores: [],
    entryPoints: [],
    ...overrides,
  };
}

const defaultOpts: FileSelectionOptions = { skipContentRead: true };

// ── Tests ────────────────────────────────────────────────────────────────────

describe('selectKeyFiles', () => {
  describe('Tier 1 - Config and documentation files', () => {
    it('selects package.json as Tier 1', () => {
      const scan = makeScanResult({ rootFiles: ['package.json', 'src/app.ts'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const pkgFile = result.files.find(f => f.path === 'package.json');
      expect(pkgFile).toBeDefined();
      expect(pkgFile!.tier).toBe(1);
      expect(pkgFile!.reason).toContain('package.json');
    });

    it('selects go.mod as Tier 1', () => {
      const scan = makeScanResult({ rootFiles: ['go.mod', 'main.go'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const goMod = result.files.find(f => f.path === 'go.mod');
      expect(goMod).toBeDefined();
      expect(goMod!.tier).toBe(1);
    });

    it('selects Cargo.toml as Tier 1', () => {
      const scan = makeScanResult({ rootFiles: ['Cargo.toml'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const cargo = result.files.find(f => f.path === 'Cargo.toml');
      expect(cargo).toBeDefined();
      expect(cargo!.tier).toBe(1);
    });

    it('selects Dockerfile as Tier 1', () => {
      const scan = makeScanResult({ rootFiles: ['Dockerfile'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const df = result.files.find(f => f.path === 'Dockerfile');
      expect(df).toBeDefined();
      expect(df!.tier).toBe(1);
    });

    it('selects docker-compose.yml as Tier 1', () => {
      const scan = makeScanResult({ rootFiles: ['docker-compose.yml'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const dc = result.files.find(f => f.path === 'docker-compose.yml');
      expect(dc).toBeDefined();
      expect(dc!.tier).toBe(1);
    });

    it('selects README.md as Tier 1', () => {
      const scan = makeScanResult({ rootFiles: ['README.md'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const readme = result.files.find(f => f.path === 'README.md');
      expect(readme).toBeDefined();
      expect(readme!.tier).toBe(1);
    });

    it('selects tsconfig.json as Tier 1', () => {
      const scan = makeScanResult({ rootFiles: ['tsconfig.json'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const ts = result.files.find(f => f.path === 'tsconfig.json');
      expect(ts).toBeDefined();
      expect(ts!.tier).toBe(1);
    });

    it('selects multiple Tier 1 files together', () => {
      const scan = makeScanResult({
        rootFiles: ['package.json', 'README.md', 'tsconfig.json', 'Dockerfile'],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const tier1Files = result.files.filter(f => f.tier === 1);
      expect(tier1Files.length).toBe(4);
    });
  });

  describe('Tier 2 - Entry points and high-value files', () => {
    it('selects src/index.ts as Tier 2 entry point', () => {
      const scan = makeScanResult({ nestedFiles: ['src/index.ts'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const entry = result.files.find(f => f.path === 'src/index.ts');
      expect(entry).toBeDefined();
      expect(entry!.tier).toBe(2);
      expect(entry!.reason).toContain('Entry point');
    });

    it('selects main.go as Tier 2 entry point', () => {
      const scan = makeScanResult({ rootFiles: ['main.go', 'go.mod'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const entry = result.files.find(f => f.path === 'main.go');
      expect(entry).toBeDefined();
      expect(entry!.tier).toBe(2);
    });

    it('selects main.py as Tier 2 entry point', () => {
      const scan = makeScanResult({ rootFiles: ['main.py'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const entry = result.files.find(f => f.path === 'main.py');
      expect(entry).toBeDefined();
      expect(entry!.tier).toBe(2);
    });

    it('selects detected entry points from project profile', () => {
      const scan = makeScanResult({ nestedFiles: ['src/server.ts'] });
      const profile = makeProfile({ entryPoints: ['src/server.ts'] });
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const entry = result.files.find(f => f.path === 'src/server.ts');
      expect(entry).toBeDefined();
      expect(entry!.tier).toBe(2);
    });

    it('selects route definition files as Tier 2', () => {
      const scan = makeScanResult({ nestedFiles: ['src/routes.ts'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const route = result.files.find(f => f.path === 'src/routes.ts');
      expect(route).toBeDefined();
      expect(route!.tier).toBe(2);
      expect(route!.reason).toContain('Route definition');
    });

    it('selects router.js as Tier 2', () => {
      const scan = makeScanResult({ nestedFiles: ['src/router.js'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const router = result.files.find(f => f.path === 'src/router.js');
      expect(router).toBeDefined();
      expect(router!.tier).toBe(2);
    });

    it('selects urls.py as Tier 2 route definition', () => {
      const scan = makeScanResult({ nestedFiles: ['app/urls.py'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const urls = result.files.find(f => f.path === 'app/urls.py');
      expect(urls).toBeDefined();
      expect(urls!.tier).toBe(2);
    });

    it('selects .proto files as Tier 2 schema files', () => {
      const scan = makeScanResult({ nestedFiles: ['proto/schema.proto'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const proto = result.files.find(f => f.path === 'proto/schema.proto');
      expect(proto).toBeDefined();
      expect(proto!.tier).toBe(2);
      expect(proto!.reason).toContain('Schema');
    });

    it('selects .graphql files as Tier 2 schema files', () => {
      const scan = makeScanResult({ nestedFiles: ['src/schema.graphql'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const gql = result.files.find(f => f.path === 'src/schema.graphql');
      expect(gql).toBeDefined();
      expect(gql!.tier).toBe(2);
    });

    it('selects openapi.yaml as Tier 2', () => {
      const scan = makeScanResult({ rootFiles: ['openapi.yaml'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const api = result.files.find(f => f.path === 'openapi.yaml');
      expect(api).toBeDefined();
      expect(api!.tier).toBe(2);
    });

    it('selects schema.prisma as Tier 2', () => {
      const scan = makeScanResult({ nestedFiles: ['prisma/schema.prisma'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const prisma = result.files.find(f => f.path === 'prisma/schema.prisma');
      expect(prisma).toBeDefined();
      expect(prisma!.tier).toBe(2);
    });
  });

  describe('Tier 3 - Structural/index files', () => {
    it('selects index.ts files in subdirectories as Tier 3', () => {
      const scan = makeScanResult({ nestedFiles: ['src/utils/index.ts'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const idx = result.files.find(f => f.path === 'src/utils/index.ts');
      expect(idx).toBeDefined();
      expect(idx!.tier).toBe(3);
      expect(idx!.reason).toContain('Module index');
    });

    it('selects __init__.py as Tier 3', () => {
      const scan = makeScanResult({ nestedFiles: ['app/__init__.py'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const init = result.files.find(f => f.path === 'app/__init__.py');
      expect(init).toBeDefined();
      expect(init!.tier).toBe(3);
    });

    it('selects mod.rs as Tier 3', () => {
      const scan = makeScanResult({ nestedFiles: ['src/utils/mod.rs'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const modRs = result.files.find(f => f.path === 'src/utils/mod.rs');
      expect(modRs).toBeDefined();
      expect(modRs!.tier).toBe(3);
    });

    it('selects index.js as Tier 3 barrel export', () => {
      const scan = makeScanResult({ nestedFiles: ['src/components/index.js'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const idx = result.files.find(f => f.path === 'src/components/index.js');
      expect(idx).toBeDefined();
      expect(idx!.tier).toBe(3);
    });
  });

  describe('Tier 4 - Representative source files', () => {
    it('selects representative files from directories without other selections', () => {
      const scan = makeScanResult({
        nestedFiles: [
          'src/services/userService.ts',
          'src/services/authService.ts',
          'src/services/paymentService.ts',
        ],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const tier4 = result.files.filter(f => f.tier === 4);
      expect(tier4.length).toBeGreaterThanOrEqual(1);
      expect(tier4.length).toBeLessThanOrEqual(2); // max 2 per dir
      expect(tier4[0].reason).toContain('Representative');
    });

    it('limits to 2 files per directory', () => {
      const scan = makeScanResult({
        nestedFiles: [
          'src/models/user.ts',
          'src/models/post.ts',
          'src/models/comment.ts',
          'src/models/tag.ts',
          'src/models/category.ts',
        ],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const tier4 = result.files.filter(f => f.tier === 4);
      expect(tier4.length).toBe(2);
    });

    it('does not duplicate files already selected in higher tiers', () => {
      const scan = makeScanResult({
        rootFiles: ['package.json'],
        nestedFiles: ['src/index.ts', 'src/app.ts'],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      // src/index.ts should be Tier 2, not duplicated as Tier 4
      const duplicates = result.files.filter(f => f.path === 'src/index.ts');
      expect(duplicates.length).toBe(1);
      expect(duplicates[0].tier).toBe(2);
    });

    it('only selects source code files (not config/data)', () => {
      const scan = makeScanResult({
        nestedFiles: [
          'data/records.json',
          'data/users.csv',
          'data/schema.sql',
        ],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      // .json, .csv, .sql are not in the source extensions list for Tier 4
      const tier4 = result.files.filter(f => f.tier === 4);
      expect(tier4.length).toBe(0);
    });
  });

  describe('Token budget', () => {
    it('respects totalTokenBudget and stops adding files', () => {
      const scan = makeScanResult({
        rootFiles: ['package.json', 'README.md', 'tsconfig.json', 'Dockerfile'],
      });
      const profile = makeProfile();
      // Very small budget - only room for ~1 file
      const result = selectKeyFiles(scan, profile, {
        skipContentRead: true,
        totalTokenBudget: 10,
      });

      expect(result.files.length).toBeLessThan(4);
      expect(result.totalTokenEstimate).toBeLessThanOrEqual(10);
    });

    it('uses default budget of 100K tokens', () => {
      const scan = makeScanResult({ rootFiles: ['package.json'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, { skipContentRead: true });

      // With skipContentRead, content is small, should fit in 100K budget
      expect(result.totalTokenEstimate).toBeLessThanOrEqual(100_000);
    });

    it('provides totalTokenEstimate in the result', () => {
      const scan = makeScanResult({
        rootFiles: ['package.json', 'README.md'],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      expect(result.totalTokenEstimate).toBeGreaterThan(0);
      expect(typeof result.totalTokenEstimate).toBe('number');
    });
  });

  describe('Tier ordering and prioritization', () => {
    it('includes Tier 1 files before Tier 2', () => {
      const scan = makeScanResult({
        rootFiles: ['package.json'],
        nestedFiles: ['src/index.ts'],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const tier1Idx = result.files.findIndex(f => f.tier === 1);
      const tier2Idx = result.files.findIndex(f => f.tier === 2);

      expect(tier1Idx).toBeLessThan(tier2Idx);
    });

    it('includes Tier 2 before Tier 3', () => {
      const scan = makeScanResult({
        nestedFiles: [
          'src/index.ts',        // Tier 2 entry point
          'src/utils/index.ts',  // Tier 3 barrel
        ],
      });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const tier2Idx = result.files.findIndex(f => f.tier === 2);
      const tier3Idx = result.files.findIndex(f => f.tier === 3);

      expect(tier2Idx).toBeLessThan(tier3Idx);
    });

    it('Tier 1 fills first even with tight budget', () => {
      const scan = makeScanResult({
        rootFiles: ['package.json'],
        nestedFiles: ['src/index.ts', 'src/utils/index.ts'],
      });
      const profile = makeProfile();
      // Budget for ~1.5 files
      const result = selectKeyFiles(scan, profile, {
        skipContentRead: true,
        totalTokenBudget: 15,
      });

      // Should prioritize Tier 1
      if (result.files.length > 0) {
        expect(result.files[0].tier).toBe(1);
      }
    });
  });

  describe('Return format', () => {
    it('returns KeyFileSet with files array and totalTokenEstimate', () => {
      const scan = makeScanResult({ rootFiles: ['package.json'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('totalTokenEstimate');
      expect(Array.isArray(result.files)).toBe(true);
    });

    it('each file has path, content, tier, and reason', () => {
      const scan = makeScanResult({ rootFiles: ['package.json'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      expect(result.files.length).toBeGreaterThan(0);
      const file = result.files[0];
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('content');
      expect(file).toHaveProperty('tier');
      expect(file).toHaveProperty('reason');
      expect(typeof file.path).toBe('string');
      expect(typeof file.content).toBe('string');
      expect([1, 2, 3, 4]).toContain(file.tier);
      expect(typeof file.reason).toBe('string');
    });

    it('returns empty files array for empty scan', () => {
      const scan: ScanResult = {
        fileTree: { root: { name: 'root', relativePath: '.', files: [], directories: [] } },
        totalFiles: 0,
        totalDirs: 0,
        languageBreakdown: {},
      };
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, defaultOpts);

      expect(result.files).toEqual([]);
      expect(result.totalTokenEstimate).toBe(0);
    });
  });

  describe('Multi-project type handling', () => {
    it('handles Node.js/TypeScript project', () => {
      const scan = makeScanResult({
        rootFiles: ['package.json', 'tsconfig.json', 'README.md'],
        nestedFiles: ['src/index.ts', 'src/routes.ts', 'src/utils/index.ts'],
      });
      const profile = makeProfile({
        entryPoints: ['src/index.ts'],
        projectType: 'single-app',
      });
      const result = selectKeyFiles(scan, profile, defaultOpts);

      // Should have Tier 1 configs + Tier 2 entry/routes + Tier 3 barrel
      expect(result.files.length).toBeGreaterThanOrEqual(5);
      expect(result.files.some(f => f.path === 'package.json' && f.tier === 1)).toBe(true);
      expect(result.files.some(f => f.path === 'src/index.ts' && f.tier === 2)).toBe(true);
      expect(result.files.some(f => f.path === 'src/routes.ts' && f.tier === 2)).toBe(true);
    });

    it('handles Go project', () => {
      const scan = makeScanResult({
        rootFiles: ['go.mod', 'main.go', 'README.md'],
        nestedFiles: ['internal/router.go', 'api/routes.go'],
      });
      const profile = makeProfile({
        entryPoints: ['main.go'],
        projectType: 'single-app',
      });
      const result = selectKeyFiles(scan, profile, defaultOpts);

      expect(result.files.some(f => f.path === 'go.mod' && f.tier === 1)).toBe(true);
      expect(result.files.some(f => f.path === 'main.go' && f.tier === 2)).toBe(true);
    });

    it('handles Python project', () => {
      const scan = makeScanResult({
        rootFiles: ['requirements.txt', 'manage.py'],
        nestedFiles: ['app/__init__.py', 'app/urls.py', 'app/models.py'],
      });
      const profile = makeProfile({
        entryPoints: ['manage.py'],
        projectType: 'single-app',
      });
      const result = selectKeyFiles(scan, profile, defaultOpts);

      expect(result.files.some(f => f.path === 'requirements.txt' && f.tier === 1)).toBe(true);
      expect(result.files.some(f => f.path === 'manage.py' && f.tier === 2)).toBe(true);
      expect(result.files.some(f => f.path === 'app/urls.py' && f.tier === 2)).toBe(true);
      expect(result.files.some(f => f.path === 'app/__init__.py' && f.tier === 3)).toBe(true);
    });

    it('handles Rust project', () => {
      const scan = makeScanResult({
        rootFiles: ['Cargo.toml'],
        nestedFiles: ['src/main.rs', 'src/lib.rs', 'src/routes/mod.rs'],
      });
      const profile = makeProfile({
        entryPoints: ['src/main.rs', 'src/lib.rs'],
        projectType: 'single-app',
      });
      const result = selectKeyFiles(scan, profile, defaultOpts);

      expect(result.files.some(f => f.path === 'Cargo.toml' && f.tier === 1)).toBe(true);
      expect(result.files.some(f => f.path === 'src/main.rs' && f.tier === 2)).toBe(true);
      expect(result.files.some(f => f.path === 'src/routes/mod.rs' && f.tier === 3)).toBe(true);
    });
  });

  describe('Deduplication', () => {
    it('does not include the same file twice', () => {
      const scan = makeScanResult({
        nestedFiles: ['src/index.ts'],
      });
      // src/index.ts matches both Tier 2 (entry point) and could match Tier 3 (index file)
      const profile = makeProfile({ entryPoints: ['src/index.ts'] });
      const result = selectKeyFiles(scan, profile, defaultOpts);

      const matchingFiles = result.files.filter(f => f.path === 'src/index.ts');
      expect(matchingFiles.length).toBe(1);
    });
  });

  describe('Options', () => {
    it('accepts custom maxLinesPerFile option', () => {
      const scan = makeScanResult({ rootFiles: ['package.json'] });
      const profile = makeProfile();
      // Just verify it doesn't throw - content reading is skipped in tests
      const result = selectKeyFiles(scan, profile, {
        skipContentRead: true,
        maxLinesPerFile: 100,
      });
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('accepts custom totalTokenBudget option', () => {
      const scan = makeScanResult({ rootFiles: ['package.json'] });
      const profile = makeProfile();
      const result = selectKeyFiles(scan, profile, {
        skipContentRead: true,
        totalTokenBudget: 50_000,
      });
      expect(result.totalTokenEstimate).toBeLessThanOrEqual(50_000);
    });

    it('accepts rootDir option', () => {
      const scan = makeScanResult({ rootFiles: ['package.json'] });
      const profile = makeProfile();
      // With skipContentRead, rootDir is not actually used
      const result = selectKeyFiles(scan, profile, {
        skipContentRead: true,
        rootDir: '/tmp/test-project',
      });
      expect(result.files.length).toBeGreaterThan(0);
    });
  });
});
