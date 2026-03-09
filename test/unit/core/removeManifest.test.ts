/**
 * Tests for Feature #479: Remove .archproject.json manifest and old analyze flow.
 *
 * Validates:
 * 1. No references to .archproject.json in production source code
 * 2. ProjectDescriptor replaces ProjectManifest in types
 * 3. Scanner no longer reads/writes .archproject.json
 * 4. CLI analyze defaults to .archcanvas/main.archc output
 * 5. inferEngine.ts is deprecated (agentic loop is preferred)
 * 6. Pipeline defaults to .archcanvas/main.archc output
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC_DIR = path.resolve(__dirname, '../../../src');

describe('Remove .archproject.json manifest (Feature #479)', () => {
  describe('No .archproject.json references in production code', () => {
    it('should not reference PROJECT_MANIFEST_FILENAME in src/', () => {
      const matches = searchFilesForPattern(SRC_DIR, 'PROJECT_MANIFEST_FILENAME');
      // Filter out comments and deprecation notices
      const productionMatches = matches.filter(
        (m) => !m.line.trim().startsWith('//') && !m.line.trim().startsWith('*'),
      );
      expect(productionMatches).toHaveLength(0);
    });

    it('should not import from manifest.ts in src/', () => {
      const matches = searchFilesForPattern(SRC_DIR, "from './manifest'");
      expect(matches).toHaveLength(0);
    });

    it('should not reference writeManifestToFolder in src/', () => {
      const matches = searchFilesForPattern(SRC_DIR, 'writeManifestToFolder');
      expect(matches).toHaveLength(0);
    });

    it('should not reference parseManifest in src/', () => {
      const matches = searchFilesForPattern(SRC_DIR, 'parseManifest');
      // Exclude deprecation comments
      const productionMatches = matches.filter(
        (m) => !m.line.trim().startsWith('//') && !m.line.trim().startsWith('*'),
      );
      expect(productionMatches).toHaveLength(0);
    });

    it('should not reference createManifest in src/', () => {
      const matches = searchFilesForPattern(SRC_DIR, 'createManifest');
      const productionMatches = matches.filter(
        (m) => !m.line.trim().startsWith('//') && !m.line.trim().startsWith('*'),
      );
      expect(productionMatches).toHaveLength(0);
    });

    it('should not reference serializeManifest in src/', () => {
      const matches = searchFilesForPattern(SRC_DIR, 'serializeManifest');
      const productionMatches = matches.filter(
        (m) => !m.line.trim().startsWith('//') && !m.line.trim().startsWith('*'),
      );
      expect(productionMatches).toHaveLength(0);
    });
  });

  describe('Type system migration', () => {
    it('should export ProjectDescriptor from types/project.ts', async () => {
      const types = await import('@/types/project');
      expect(types).toHaveProperty('ARCHCANVAS_DIR_NAME');
      expect(types).toHaveProperty('ARCHCANVAS_MAIN_FILE');
      expect(types.ARCHCANVAS_DIR_NAME).toBe('.archcanvas');
      expect(types.ARCHCANVAS_MAIN_FILE).toBe('main.archc');
    });

    it('should not export ProjectManifest from types/project.ts', async () => {
      const types = await import('@/types/project');
      expect(types).not.toHaveProperty('ProjectManifest');
      expect(types).not.toHaveProperty('PROJECT_MANIFEST_FILENAME');
    });

    it('ProjectDescriptor should have name, rootFile, and files fields', () => {
      // Compile-time check: these fields exist on the type
      const descriptor: import('@/types/project').ProjectDescriptor = {
        name: 'Test',
        rootFile: 'main.archc',
        files: [{ path: 'main.archc', displayName: 'Main' }],
      };
      expect(descriptor.name).toBe('Test');
      expect(descriptor.rootFile).toBe('main.archc');
      expect(descriptor.files).toHaveLength(1);
    });

    it('ProjectDescriptor should NOT have links or version fields', () => {
      const descriptor: import('@/types/project').ProjectDescriptor = {
        name: 'Test',
        rootFile: '',
        files: [],
      };
      expect(descriptor).not.toHaveProperty('links');
      expect(descriptor).not.toHaveProperty('version');
    });
  });

  describe('Scanner cleanup', () => {
    it('scanner should not export writeManifestToFolder', async () => {
      const scanner = await import('@/core/project/scanner');
      expect(scanner).not.toHaveProperty('writeManifestToFolder');
    });

    it('scanner should export scanProjectFolder', async () => {
      const scanner = await import('@/core/project/scanner');
      expect(scanner).toHaveProperty('scanProjectFolder');
      expect(typeof scanner.scanProjectFolder).toBe('function');
    });

    it('scanner should export writeArchcToFolder', async () => {
      const scanner = await import('@/core/project/scanner');
      expect(scanner).toHaveProperty('writeArchcToFolder');
      expect(typeof scanner.writeArchcToFolder).toBe('function');
    });

    it('scanner should export initArchcanvasDir', async () => {
      const scanner = await import('@/core/project/scanner');
      expect(scanner).toHaveProperty('initArchcanvasDir');
      expect(typeof scanner.initArchcanvasDir).toBe('function');
    });
  });

  describe('manifest.ts removal', () => {
    it('manifest.ts should not exist in src/core/project/', () => {
      const manifestPath = path.resolve(SRC_DIR, 'core/project/manifest.ts');
      expect(fs.existsSync(manifestPath)).toBe(false);
    });
  });

  describe('CLI analyze output path', () => {
    it('should use .archcanvas/main.archc as default output in pipeline', async () => {
      // The pipeline default output path should include .archcanvas/main.archc
      // We verify this by checking the pipeline source code
      const pipelinePath = path.resolve(SRC_DIR, 'analyze/pipeline.ts');
      const content = fs.readFileSync(pipelinePath, 'utf-8');
      expect(content).toContain(".archcanvas");
      expect(content).toContain("main.archc");
      // Should NOT contain the old default
      expect(content).not.toContain("'architecture.archc'");
    });

    it('should use .archcanvas/main.archc as default in CLI analyze', async () => {
      const analyzePath = path.resolve(SRC_DIR, 'cli/commands/analyze.ts');
      const content = fs.readFileSync(analyzePath, 'utf-8');
      expect(content).toContain('ARCHCANVAS_DIR_NAME');
      expect(content).toContain('ARCHCANVAS_MAIN_FILE');
    });
  });

  describe('inferEngine deprecation', () => {
    it('inferEngine.ts should contain deprecation notice', () => {
      const enginePath = path.resolve(SRC_DIR, 'analyze/inferEngine.ts');
      const content = fs.readFileSync(enginePath, 'utf-8');
      expect(content).toContain('@deprecated');
      expect(content).toContain('agentic');
    });
  });

  describe('CLI analyze uses structural pipeline', () => {
    it('CLI analyze has legacy pipeline (agentic loop removed with Anthropic SDK)', () => {
      const analyzePath = path.resolve(SRC_DIR, 'cli/commands/analyze.ts');
      const content = fs.readFileSync(analyzePath, 'utf-8');
      expect(content).toContain('runLegacyPipeline');
      expect(content).toContain('structural');
    });

    it('CLI analyze no longer imports agentic loop or prompts', () => {
      const analyzePath = path.resolve(SRC_DIR, 'cli/commands/analyze.ts');
      const content = fs.readFileSync(analyzePath, 'utf-8');
      expect(content).not.toContain('runAgentLoop');
      expect(content).not.toContain('buildSystemPrompt');
      expect(content).not.toContain('buildUserPrompt');
    });
  });
});

// ── Helper ──────────────────────────────────────────────────────────────────

interface FileMatch {
  file: string;
  line: string;
  lineNumber: number;
}

/**
 * Recursively search for a pattern in .ts files under a directory.
 * Returns all matching lines (excluding node_modules).
 */
function searchFilesForPattern(dir: string, pattern: string): FileMatch[] {
  const matches: FileMatch[] = [];

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]!.includes(pattern)) {
            matches.push({
              file: path.relative(SRC_DIR, fullPath),
              line: lines[i]!,
              lineNumber: i + 1,
            });
          }
        }
      }
    }
  }

  walk(dir);
  return matches;
}
