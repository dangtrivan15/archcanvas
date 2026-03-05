/**
 * Tests for the MCP analyze_codebase tool handler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAnalyzeCodebase, type ToolHandlerContext } from '@/mcp/handlers';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';
import { TOOL_DEFINITIONS } from '@/mcp/tools';
import type { AnalyzeProgress } from '@/analyze/pipeline';

// Mock the analysis pipeline
vi.mock('@/analyze/pipeline', () => ({
  analyzeCodebase: vi.fn(),
}));

// Mock node:fs for directory validation
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    statSync: vi.fn(),
  };
});

function createTestContext(): ToolHandlerContext {
  const registry = new RegistryManager();
  registry.initialize();
  const graph = createEmptyGraph('Test Architecture');
  const textApi = new TextApi(graph, registry);
  return { textApi, registry };
}

describe('MCP analyze_codebase tool', () => {
  let ctx: ToolHandlerContext;

  beforeEach(() => {
    ctx = createTestContext();
    vi.clearAllMocks();
  });

  describe('TOOL_DEFINITIONS', () => {
    it('should include analyze_codebase in tool definitions', () => {
      expect(TOOL_DEFINITIONS.analyze_codebase).toBeDefined();
      expect(TOOL_DEFINITIONS.analyze_codebase.name).toBe('analyze_codebase');
    });

    it('should have correct input schema with required directory field', () => {
      const schema = TOOL_DEFINITIONS.analyze_codebase.inputSchema;
      expect(schema.directory).toBeDefined();
      expect(schema.output_path).toBeDefined();
      expect(schema.depth).toBeDefined();
      expect(schema.architecture_name).toBeDefined();
    });

    it('should have a descriptive description', () => {
      expect(TOOL_DEFINITIONS.analyze_codebase.description).toContain('Analyze');
      expect(TOOL_DEFINITIONS.analyze_codebase.description).toContain('codebase');
    });
  });

  describe('handleAnalyzeCodebase', () => {
    it('should return error for non-existent directory', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = await handleAnalyzeCodebase(ctx, {
        directory: '/nonexistent/path',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Directory not accessible');
    });

    it('should return error when path is a file not a directory', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => false,
      });

      const result = await handleAnalyzeCodebase(ctx, {
        directory: '/some/file.txt',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('not a directory');
    });

    it('should call analyzeCodebase with correct options on success', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockResolvedValue({
        outputPath: '/test/project/architecture.archc',
        stats: { nodes: 5, edges: 3, codeRefs: 2 },
        projectProfile: {
          projectType: 'web-app',
          languages: [{ name: 'TypeScript', percentage: 80 }],
          frameworks: [{ name: 'React', confidence: 'high', evidence: 'package.json' }],
          dataStores: [{ type: 'PostgreSQL', evidence: 'docker-compose.yml' }],
          infraSignals: [],
          entryPoints: [],
        },
        warnings: [],
        duration: 1234,
        inferenceResult: {
          architectureName: 'TestProject',
          architectureDescription: 'A test project',
          nodes: [],
          edges: [],
        },
      });

      const result = await handleAnalyzeCodebase(ctx, {
        directory: '/test/project',
        depth: 'quick',
        architecture_name: 'My Architecture',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.output_path).toBe('/test/project/architecture.archc');
      expect(parsed.nodes_created).toBe(5);
      expect(parsed.edges_created).toBe(3);
      expect(parsed.code_refs_linked).toBe(2);
      expect(parsed.architecture_name).toBe('TestProject');
      expect(parsed.summary).toContain('TypeScript');
      expect(parsed.summary).toContain('React');
      expect(parsed.summary).toContain('PostgreSQL');
    });

    it('should pass depth option correctly', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockResolvedValue({
        outputPath: '/test/architecture.archc',
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {
          projectType: 'unknown',
          languages: [],
          frameworks: [],
          dataStores: [],
          infraSignals: [],
          entryPoints: [],
        },
        warnings: [],
        duration: 100,
        inferenceResult: {
          architectureName: 'Test',
          architectureDescription: '',
          nodes: [],
          edges: [],
        },
      });

      await handleAnalyzeCodebase(ctx, {
        directory: '/test',
        depth: 'deep',
      });

      expect(analyzeCodebase).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          analysisDepth: 'deep',
        }),
      );
    });

    it('should include warnings in summary when present', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockResolvedValue({
        outputPath: '/test/architecture.archc',
        stats: { nodes: 2, edges: 1, codeRefs: 0 },
        projectProfile: {
          projectType: 'web-app',
          languages: [],
          frameworks: [],
          dataStores: [],
          infraSignals: [],
          entryPoints: [],
        },
        warnings: ['AI inference failed', 'Some files skipped'],
        duration: 500,
        inferenceResult: {
          architectureName: 'Test',
          architectureDescription: '',
          nodes: [],
          edges: [],
        },
      });

      const result = await handleAnalyzeCodebase(ctx, { directory: '/test' });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.summary).toContain('Warnings');
      expect(parsed.summary).toContain('AI inference failed');
    });

    it('should handle pipeline errors gracefully', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Scan failed: permission denied'),
      );

      const result = await handleAnalyzeCodebase(ctx, { directory: '/test' });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Analysis failed');
      expect(parsed.error).toContain('permission denied');
    });

    it('should pass output_path to pipeline options', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockResolvedValue({
        outputPath: '/custom/output.archc',
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {
          projectType: 'unknown',
          languages: [],
          frameworks: [],
          dataStores: [],
          infraSignals: [],
          entryPoints: [],
        },
        warnings: [],
        duration: 100,
        inferenceResult: {
          architectureName: 'Test',
          architectureDescription: '',
          nodes: [],
          edges: [],
        },
      });

      await handleAnalyzeCodebase(ctx, {
        directory: '/test',
        output_path: '/custom/output.archc',
      });

      expect(analyzeCodebase).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          outputPath: '/custom/output.archc',
        }),
      );
    });

    it('should forward progress events to onProgress callback', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      // Capture the onProgress callback from the pipeline options
      let capturedOnProgress: ((event: AnalyzeProgress) => void) | undefined;
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockImplementation(
        async (_dir: string, opts: { onProgress?: (event: AnalyzeProgress) => void }) => {
          capturedOnProgress = opts.onProgress;
          // Simulate progress events
          opts.onProgress?.({ phase: 'scanning', message: 'Scanning...', percent: 10 });
          opts.onProgress?.({ phase: 'complete', message: 'Done', percent: 100 });
          return {
            outputPath: '/test/architecture.archc',
            stats: { nodes: 1, edges: 0, codeRefs: 0 },
            projectProfile: {
              projectType: 'unknown',
              languages: [],
              frameworks: [],
              dataStores: [],
              infraSignals: [],
              entryPoints: [],
            },
            warnings: [],
            duration: 100,
            inferenceResult: {
              architectureName: 'Test',
              architectureDescription: '',
              nodes: [],
              edges: [],
            },
          };
        },
      );

      const progressEvents: AnalyzeProgress[] = [];
      await handleAnalyzeCodebase(
        ctx,
        { directory: '/test' },
        (event) => progressEvents.push(event),
      );

      expect(progressEvents.length).toBe(2);
      expect(progressEvents[0].phase).toBe('scanning');
      expect(progressEvents[1].phase).toBe('complete');
    });

    it('should return structured result with all required fields', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockResolvedValue({
        outputPath: '/test/architecture.archc',
        stats: { nodes: 10, edges: 8, codeRefs: 5 },
        projectProfile: {
          projectType: 'microservices',
          languages: [{ name: 'Go', percentage: 60 }, { name: 'TypeScript', percentage: 40 }],
          frameworks: [{ name: 'Gin', confidence: 'high', evidence: 'go.mod' }],
          dataStores: [],
          infraSignals: [],
          entryPoints: [],
        },
        warnings: [],
        duration: 3000,
        inferenceResult: {
          architectureName: 'MyProject',
          architectureDescription: 'Microservices project',
          nodes: [],
          edges: [],
        },
      });

      const result = await handleAnalyzeCodebase(ctx, { directory: '/test' });
      const parsed = JSON.parse(result);

      // Verify all required fields in the response
      expect(parsed).toHaveProperty('success', true);
      expect(parsed).toHaveProperty('output_path');
      expect(parsed).toHaveProperty('architecture_name');
      expect(parsed).toHaveProperty('nodes_created');
      expect(parsed).toHaveProperty('edges_created');
      expect(parsed).toHaveProperty('code_refs_linked');
      expect(parsed).toHaveProperty('summary');
      expect(typeof parsed.summary).toBe('string');
      expect(parsed.summary.length).toBeGreaterThan(0);
    });

    it('should default depth to standard when not provided', async () => {
      const fs = await import('node:fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      });

      const { analyzeCodebase } = await import('@/analyze/pipeline');
      (analyzeCodebase as ReturnType<typeof vi.fn>).mockResolvedValue({
        outputPath: '/test/architecture.archc',
        stats: { nodes: 1, edges: 0, codeRefs: 0 },
        projectProfile: {
          projectType: 'unknown',
          languages: [],
          frameworks: [],
          dataStores: [],
          infraSignals: [],
          entryPoints: [],
        },
        warnings: [],
        duration: 100,
        inferenceResult: {
          architectureName: 'Test',
          architectureDescription: '',
          nodes: [],
          edges: [],
        },
      });

      await handleAnalyzeCodebase(ctx, { directory: '/test' });

      expect(analyzeCodebase).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          analysisDepth: 'standard',
        }),
      );
    });
  });
});
