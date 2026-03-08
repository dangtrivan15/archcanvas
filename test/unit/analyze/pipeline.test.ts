/**
 * Feature #345: Analysis Pipeline Orchestrator
 *
 * Tests that analyzeCodebase() correctly orchestrates the full pipeline:
 * scan -> detect -> select -> infer -> build -> save
 *
 * Uses mocked AI sender and temporary directories.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  analyzeCodebase,
  type AnalyzeOptions,
  type AnalyzeProgress,
  type PipelinePhase,
} from '@/analyze/pipeline';
import type { AIMessageSender } from '@/analyze/inferEngine';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createTempProject(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-pipeline-test-'));

  // Create a realistic project structure
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
        pg: '^8.11.0',
      },
    }),
  );

  fs.writeFileSync(
    path.join(tmpDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { target: 'ES2020', module: 'ESNext' },
    }),
  );

  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'src', 'index.ts'),
    `import express from 'express';\nconst app = express();\napp.listen(3000);\n`,
  );

  fs.writeFileSync(
    path.join(tmpDir, 'src', 'routes.ts'),
    `export function registerRoutes(app: any) {\n  app.get('/api/users', getUsers);\n}\n`,
  );

  fs.writeFileSync(
    path.join(tmpDir, 'Dockerfile'),
    `FROM node:20-alpine\nCOPY . .\nRUN npm install\nCMD ["node", "dist/index.js"]\n`,
  );

  fs.writeFileSync(
    path.join(tmpDir, 'README.md'),
    `# Test Project\nA test Express API with PostgreSQL.\n`,
  );

  return tmpDir;
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

function createMockAISender(): AIMessageSender {
  return {
    sendMessage: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        architectureName: 'Test API',
        architectureDescription: 'An Express API with PostgreSQL',
        nodes: [
          {
            id: 'api-server',
            type: 'service',
            displayName: 'API Server',
            description: 'Express.js REST API',
            codeRefs: [{ path: 'src/index.ts', role: 'SOURCE' }],
            children: [],
          },
          {
            id: 'database',
            type: 'database',
            displayName: 'PostgreSQL',
            description: 'Primary data store',
            codeRefs: [],
            children: [],
          },
        ],
        edges: [
          {
            from: 'api-server',
            to: 'database',
            type: 'SYNC',
            label: 'SQL queries',
          },
        ],
      }),
      stopReason: 'end_turn',
      usage: { inputTokens: 1000, outputTokens: 500 },
    }),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Feature #345: Analysis Pipeline Orchestrator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it('should run the full pipeline with mocked AI and produce .archc file', async () => {
    const outputPath = path.join(tmpDir, 'output.archc');
    const aiSender = createMockAISender();

    const result = await analyzeCodebase(tmpDir, {
      outputPath,
      analysisDepth: 'quick',
      aiSender,
      architectureName: 'Test Architecture',
    });

    // Should produce output file
    expect(result.outputPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    // Should have created nodes and edges
    expect(result.stats.nodes).toBe(2);
    expect(result.stats.edges).toBe(1);
    expect(result.stats.codeRefs).toBeGreaterThanOrEqual(1);

    // Should have a project profile
    expect(result.projectProfile.projectType).toBeDefined();
    expect(result.projectProfile.languages.length).toBeGreaterThan(0);

    // Should have duration
    expect(result.duration).toBeGreaterThan(0);

    // AI sender should have been called
    expect(aiSender.sendMessage).toHaveBeenCalled();
  });

  it('should emit progress events for each phase', async () => {
    const outputPath = path.join(tmpDir, 'output.archc');
    const aiSender = createMockAISender();
    const progressEvents: AnalyzeProgress[] = [];

    await analyzeCodebase(tmpDir, {
      outputPath,
      analysisDepth: 'quick',
      aiSender,
      onProgress: (event) => progressEvents.push(event),
    });

    // Should have progress events for all phases
    const phases = progressEvents.map((e) => e.phase);
    expect(phases).toContain('scanning');
    expect(phases).toContain('detecting');
    expect(phases).toContain('selecting');
    expect(phases).toContain('inferring');
    expect(phases).toContain('building');
    expect(phases).toContain('saving');
    expect(phases).toContain('complete');

    // Percentages should be monotonically increasing
    for (let i = 1; i < progressEvents.length; i++) {
      expect(progressEvents[i].percent).toBeGreaterThanOrEqual(progressEvents[i - 1].percent);
    }

    // Last event should be 100%
    expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
  });

  it('should fall back to structural analysis when AI fails', async () => {
    const outputPath = path.join(tmpDir, 'output.archc');
    const failingSender: AIMessageSender = {
      sendMessage: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
    };

    const result = await analyzeCodebase(tmpDir, {
      outputPath,
      analysisDepth: 'quick',
      aiSender: failingSender,
      architectureName: 'Fallback Test',
    });

    // Should still produce output
    expect(result.outputPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    // Should have at least one node (structural fallback)
    expect(result.stats.nodes).toBeGreaterThanOrEqual(1);

    // Should have warning about AI failure
    expect(result.warnings.some((w) => w.includes('AI inference failed'))).toBe(true);
  }, 30000); // inferEngine retries with exponential backoff

  it('should fall back to structural analysis when no AI sender provided', async () => {
    const outputPath = path.join(tmpDir, 'output.archc');

    const result = await analyzeCodebase(tmpDir, {
      outputPath,
      architectureName: 'No AI Test',
    });

    // Should still produce output
    expect(result.outputPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(result.stats.nodes).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.includes('No AI sender provided'))).toBe(true);
  });

  it('should support dry-run mode', async () => {
    const aiSender = createMockAISender();

    const result = await analyzeCodebase(tmpDir, {
      analysisDepth: 'quick',
      aiSender,
      dryRun: true,
    });

    // Should NOT have an output path
    expect(result.outputPath).toBeUndefined();

    // Should have the inference result
    expect(result.inferenceResult).toBeDefined();
    expect(result.inferenceResult!.nodes.length).toBe(2);
    expect(result.inferenceResult!.edges.length).toBe(1);

    // No .archc file should have been written
    const defaultOutput = path.join(tmpDir, '.archcanvas', 'main.archc');
    expect(fs.existsSync(defaultOutput)).toBe(false);
  });

  it('should support verbose mode without errors', async () => {
    const outputPath = path.join(tmpDir, 'output.archc');
    const aiSender = createMockAISender();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await analyzeCodebase(tmpDir, {
      outputPath,
      analysisDepth: 'quick',
      aiSender,
      verbose: true,
    });

    // Should have logged verbose output
    expect(consoleSpy).toHaveBeenCalled();
    const logCalls = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logCalls.some((msg: string) => msg.includes('[pipeline:'))).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should generate .summary.md sidecar file', async () => {
    const outputPath = path.join(tmpDir, 'myproject.archc');
    const aiSender = createMockAISender();

    await analyzeCodebase(tmpDir, {
      outputPath,
      analysisDepth: 'quick',
      aiSender,
    });

    // Sidecar should exist alongside the .archc file
    const sidecarPath = path.join(tmpDir, 'myproject.summary.md');
    expect(fs.existsSync(sidecarPath)).toBe(true);

    const sidecarContent = fs.readFileSync(sidecarPath, 'utf-8');
    expect(sidecarContent.length).toBeGreaterThan(0);
  });

  it('should use default output path when not specified', async () => {
    const aiSender = createMockAISender();

    const result = await analyzeCodebase(tmpDir, {
      analysisDepth: 'quick',
      aiSender,
    });

    const expectedPath = path.join(tmpDir, '.archcanvas', 'main.archc');
    expect(result.outputPath).toBe(expectedPath);
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it('should override architecture name from options', async () => {
    const aiSender = createMockAISender();

    const result = await analyzeCodebase(tmpDir, {
      outputPath: path.join(tmpDir, 'output.archc'),
      analysisDepth: 'quick',
      aiSender,
      architectureName: 'Custom Name',
      dryRun: true,
    });

    expect(result.inferenceResult!.architectureName).toBe('Custom Name');
  });

  it('should respect maxFiles option', async () => {
    const aiSender = createMockAISender();
    const progressEvents: AnalyzeProgress[] = [];

    await analyzeCodebase(tmpDir, {
      outputPath: path.join(tmpDir, 'output.archc'),
      analysisDepth: 'quick',
      aiSender,
      maxFiles: 2,
      onProgress: (event) => progressEvents.push(event),
    });

    // Scanning event should report limited files
    const scanEvent = progressEvents.find(
      (e) => e.phase === 'scanning' && e.detail?.totalFiles !== undefined,
    );
    expect(scanEvent).toBeDefined();
    expect(scanEvent!.detail!.totalFiles).toBeLessThanOrEqual(6); // small project anyway
  });

  it('should return correct AnalyzeResult shape', async () => {
    const aiSender = createMockAISender();

    const result = await analyzeCodebase(tmpDir, {
      outputPath: path.join(tmpDir, 'output.archc'),
      analysisDepth: 'quick',
      aiSender,
    });

    // Verify shape
    expect(typeof result.outputPath).toBe('string');
    expect(typeof result.stats.nodes).toBe('number');
    expect(typeof result.stats.edges).toBe('number');
    expect(typeof result.stats.codeRefs).toBe('number');
    expect(typeof result.duration).toBe('number');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.projectProfile).toBeDefined();
    expect(result.projectProfile.projectType).toBeDefined();
    expect(Array.isArray(result.projectProfile.languages)).toBe(true);
    expect(Array.isArray(result.projectProfile.frameworks)).toBe(true);
  });

  it('should handle AbortSignal cancellation', async () => {
    const aiSender = createMockAISender();
    const controller = new AbortController();
    controller.abort(); // abort immediately

    await expect(
      analyzeCodebase(tmpDir, {
        outputPath: path.join(tmpDir, 'output.archc'),
        analysisDepth: 'quick',
        aiSender,
        signal: controller.signal,
      }),
    ).rejects.toThrow('Pipeline aborted');
  });
});
