import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  scanDirectory,
  parseGitignore,
  isIgnored,
  type ScanResult,
  type ScanOptions,
} from '../../../src/analyze/scanner';

// Helper to create a temporary directory structure
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-test-'));
}

function createFile(dir: string, relativePath: string, content = ''): void {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('parseGitignore', () => {
  it('should parse simple patterns', () => {
    const rules = parseGitignore('*.log\nbuild/\n');
    expect(rules).toHaveLength(2);
    expect(rules[0].pattern).toBe('*.log');
    expect(rules[0].negated).toBe(false);
    expect(rules[0].dirOnly).toBe(false);
    expect(rules[1].pattern).toBe('build');
    expect(rules[1].dirOnly).toBe(true);
  });

  it('should skip comments and empty lines', () => {
    const rules = parseGitignore('# comment\n\n*.log\n  \n# another\n');
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe('*.log');
  });

  it('should handle negated patterns', () => {
    const rules = parseGitignore('*.log\n!important.log\n');
    expect(rules).toHaveLength(2);
    expect(rules[0].negated).toBe(false);
    expect(rules[1].negated).toBe(true);
    expect(rules[1].pattern).toBe('important.log');
  });

  it('should handle escaped leading characters', () => {
    const rules = parseGitignore('\\#file\n\\!file\n');
    expect(rules).toHaveLength(2);
    expect(rules[0].pattern).toBe('#file');
    expect(rules[1].pattern).toBe('!file');
  });
});

describe('isIgnored', () => {
  it('should match simple filename patterns', () => {
    const rules = parseGitignore('*.log');
    expect(isIgnored('debug.log', false, rules)).toBe(true);
    expect(isIgnored('src/debug.log', false, rules)).toBe(true);
    expect(isIgnored('debug.txt', false, rules)).toBe(false);
  });

  it('should match directory-only patterns', () => {
    const rules = parseGitignore('build/');
    expect(isIgnored('build', true, rules)).toBe(true);
    expect(isIgnored('build', false, rules)).toBe(false); // file named build should not match
  });

  it('should handle negation (un-ignore)', () => {
    const rules = parseGitignore('*.log\n!important.log');
    expect(isIgnored('debug.log', false, rules)).toBe(true);
    expect(isIgnored('important.log', false, rules)).toBe(false);
  });

  it('should match patterns with path separators', () => {
    const rules = parseGitignore('doc/frotz');
    expect(isIgnored('doc/frotz', false, rules)).toBe(true);
    expect(isIgnored('other/frotz', false, rules)).toBe(false);
  });

  it('should handle ** patterns', () => {
    const rules = parseGitignore('**/logs');
    expect(isIgnored('logs', false, rules)).toBe(true);
    expect(isIgnored('src/logs', false, rules)).toBe(true);
    expect(isIgnored('src/deep/logs', false, rules)).toBe(true);
  });

  it('should handle question mark wildcard', () => {
    const rules = parseGitignore('?.txt');
    expect(isIgnored('a.txt', false, rules)).toBe(true);
    expect(isIgnored('ab.txt', false, rules)).toBe(false);
  });
});

describe('scanDirectory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    removeTempDir(tmpDir);
  });

  it('should scan a simple directory with files', async () => {
    createFile(tmpDir, 'hello.ts', 'console.log("hello")');
    createFile(tmpDir, 'world.ts', 'console.log("world")');

    const result = await scanDirectory(tmpDir);

    expect(result.totalFiles).toBe(2);
    expect(result.totalDirs).toBe(0);
    expect(result.fileTree.root.files).toHaveLength(2);
    expect(result.languageBreakdown['.ts']).toBe(2);
  });

  it('should scan nested directories', async () => {
    createFile(tmpDir, 'src/index.ts', '');
    createFile(tmpDir, 'src/utils/helper.ts', '');
    createFile(tmpDir, 'README.md', '');

    const result = await scanDirectory(tmpDir);

    expect(result.totalFiles).toBe(3);
    expect(result.totalDirs).toBe(2); // src, src/utils
    expect(result.fileTree.root.directories).toHaveLength(1);
    expect(result.fileTree.root.directories[0].name).toBe('src');
    expect(result.fileTree.root.directories[0].directories).toHaveLength(1);
    expect(result.fileTree.root.directories[0].directories[0].name).toBe('utils');
  });

  it('should collect file metadata (size, extension, lastModified)', async () => {
    createFile(tmpDir, 'hello.ts', 'const x = 1;');
    const result = await scanDirectory(tmpDir);

    const file = result.fileTree.root.files[0];
    expect(file.name).toBe('hello.ts');
    expect(file.relativePath).toBe('hello.ts');
    expect(file.extension).toBe('.ts');
    expect(file.size).toBe(12); // 'const x = 1;'.length
    expect(file.lastModified).toBeGreaterThan(0);
  });

  it('should skip built-in ignore directories (node_modules, .git, dist)', async () => {
    createFile(tmpDir, 'src/index.ts', '');
    createFile(tmpDir, 'node_modules/pkg/index.js', '');
    createFile(tmpDir, '.git/config', '');
    createFile(tmpDir, 'dist/bundle.js', '');
    createFile(tmpDir, '__pycache__/cache.pyc', '');
    createFile(tmpDir, 'target/release/bin', '');
    createFile(tmpDir, 'vendor/lib.go', '');

    const result = await scanDirectory(tmpDir);

    expect(result.totalFiles).toBe(1); // only src/index.ts
    const allPaths = collectAllFilePaths(result);
    expect(allPaths).toContain('src/index.ts');
    expect(allPaths).not.toContain('node_modules/pkg/index.js');
    expect(allPaths).not.toContain('.git/config');
    expect(allPaths).not.toContain('dist/bundle.js');
  });

  it('should respect .gitignore rules', async () => {
    createFile(tmpDir, '.gitignore', '*.log\ntmp/\n');
    createFile(tmpDir, 'app.ts', '');
    createFile(tmpDir, 'debug.log', '');
    createFile(tmpDir, 'tmp/cache.txt', '');

    const result = await scanDirectory(tmpDir);

    const allPaths = collectAllFilePaths(result);
    expect(allPaths).toContain('app.ts');
    expect(allPaths).toContain('.gitignore');
    expect(allPaths).not.toContain('debug.log');
    expect(allPaths).not.toContain('tmp/cache.txt');
  });

  it('should respect nested .gitignore files', async () => {
    createFile(tmpDir, 'src/.gitignore', '*.test.ts\n');
    createFile(tmpDir, 'src/index.ts', '');
    createFile(tmpDir, 'src/index.test.ts', '');
    createFile(tmpDir, 'root.test.ts', ''); // Not ignored (no .gitignore at root for *.test.ts)

    const result = await scanDirectory(tmpDir);

    const allPaths = collectAllFilePaths(result);
    expect(allPaths).toContain('src/index.ts');
    expect(allPaths).not.toContain('src/index.test.ts');
    expect(allPaths).toContain('root.test.ts');
  });

  it('should support configurable maxDepth', async () => {
    createFile(tmpDir, 'a/b/c/d/e/deep.ts', '');
    createFile(tmpDir, 'a/shallow.ts', '');

    const result = await scanDirectory(tmpDir, { maxDepth: 2 });

    const allPaths = collectAllFilePaths(result);
    expect(allPaths).toContain('a/shallow.ts');
    // depth 0=root, 1=a, 2=b, 3=c (beyond maxDepth 2)
    expect(allPaths).not.toContain('a/b/c/d/e/deep.ts');
  });

  it('should support configurable maxFiles', async () => {
    for (let i = 0; i < 20; i++) {
      createFile(tmpDir, `file${i.toString().padStart(2, '0')}.ts`, '');
    }

    const result = await scanDirectory(tmpDir, { maxFiles: 5 });

    expect(result.totalFiles).toBe(5);
  });

  it('should support additional ignore patterns', async () => {
    createFile(tmpDir, 'src/index.ts', '');
    createFile(tmpDir, 'src/secret.env', '');
    createFile(tmpDir, 'docs/readme.md', '');

    const result = await scanDirectory(tmpDir, {
      additionalIgnore: ['*.env', 'docs/'],
    });

    const allPaths = collectAllFilePaths(result);
    expect(allPaths).toContain('src/index.ts');
    expect(allPaths).not.toContain('src/secret.env');
    expect(allPaths).not.toContain('docs/readme.md');
  });

  it('should produce correct language breakdown by extension', async () => {
    createFile(tmpDir, 'a.ts', '');
    createFile(tmpDir, 'b.ts', '');
    createFile(tmpDir, 'c.js', '');
    createFile(tmpDir, 'd.py', '');
    createFile(tmpDir, 'Makefile', ''); // no extension

    const result = await scanDirectory(tmpDir);

    expect(result.languageBreakdown['.ts']).toBe(2);
    expect(result.languageBreakdown['.js']).toBe(1);
    expect(result.languageBreakdown['.py']).toBe(1);
    expect(result.languageBreakdown['(no extension)']).toBe(1);
  });

  it('should return file paths relative to root', async () => {
    createFile(tmpDir, 'src/components/Button.tsx', '');

    const result = await scanDirectory(tmpDir);

    const file = result.fileTree.root.directories[0].directories[0].files[0];
    expect(file.relativePath).toBe('src/components/Button.tsx');
  });

  it('should set root relativePath to "."', async () => {
    createFile(tmpDir, 'file.ts', '');
    const result = await scanDirectory(tmpDir);
    expect(result.fileTree.root.relativePath).toBe('.');
  });

  it('should handle empty directories gracefully', async () => {
    fs.mkdirSync(path.join(tmpDir, 'empty'), { recursive: true });

    const result = await scanDirectory(tmpDir);

    expect(result.totalFiles).toBe(0);
    expect(result.totalDirs).toBe(1);
    expect(result.fileTree.root.directories).toHaveLength(1);
    expect(result.fileTree.root.directories[0].files).toHaveLength(0);
  });

  it('should sort entries deterministically', async () => {
    createFile(tmpDir, 'zebra.ts', '');
    createFile(tmpDir, 'alpha.ts', '');
    createFile(tmpDir, 'middle.ts', '');

    const result = await scanDirectory(tmpDir);
    const names = result.fileTree.root.files.map((f) => f.name);
    expect(names).toEqual(['alpha.ts', 'middle.ts', 'zebra.ts']);
  });

  it('should use default options when none provided', async () => {
    createFile(tmpDir, 'file.ts', '');
    const result = await scanDirectory(tmpDir);
    expect(result.totalFiles).toBe(1);
    // Just verify it works with defaults (maxDepth=10, maxFiles=10000)
  });

  it('should handle non-existent root directory gracefully', async () => {
    const result = await scanDirectory(path.join(tmpDir, 'nonexistent'));
    expect(result.totalFiles).toBe(0);
    expect(result.totalDirs).toBe(0);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectAllFilePaths(result: ScanResult): string[] {
  const paths: string[] = [];

  function walkDir(dir: typeof result.fileTree.root) {
    for (const f of dir.files) {
      paths.push(f.relativePath);
    }
    for (const d of dir.directories) {
      walkDir(d);
    }
  }

  walkDir(result.fileTree.root);
  return paths;
}
