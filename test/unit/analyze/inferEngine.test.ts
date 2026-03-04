import { describe, it, expect, vi } from 'vitest';
import {
  inferArchitecture,
  extractJson,
  batchFiles,
  mergeResults,
  inferenceResultSchema,
  InferenceError,
  type AIMessageSender,
  type InferenceResult,
  type InferenceOptions,
  type InferenceProgressEvent,
  type InferredNode,
} from '../../../src/analyze/inferEngine';
import type { ProjectProfile } from '../../../src/analyze/detector';
import type { KeyFileSet, SelectedFile } from '../../../src/analyze/fileSelector';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    languages: [{ name: 'TypeScript', extensions: ['.ts', '.tsx'], fileCount: 50, percentage: 80 }],
    frameworks: [{ name: 'React', confidence: 'high', evidence: 'package.json' }],
    projectType: 'single-app',
    buildSystems: ['npm'],
    infraSignals: [],
    dataStores: [],
    entryPoints: ['src/index.ts'],
    ...overrides,
  };
}

function makeKeyFiles(files: SelectedFile[] = []): KeyFileSet {
  if (files.length === 0) {
    files = [
      {
        path: 'package.json',
        content: '{"name": "test-app", "dependencies": {"express": "^4.18.0"}}',
        tier: 1,
        reason: 'Project config file',
      },
      {
        path: 'src/index.ts',
        content: 'import express from "express";\nconst app = express();\napp.listen(3000);',
        tier: 2,
        reason: 'Entry point',
      },
    ];
  }
  return {
    files,
    totalTokenEstimate: files.reduce((sum, f) => sum + Math.ceil(f.content.length / 4), 0),
  };
}

/** Valid inference result JSON for a simple Express app */
const VALID_QUICK_RESPONSE: InferenceResult = {
  architectureName: 'Test Express App',
  architectureDescription: 'A simple Express.js web application',
  nodes: [
    {
      id: 'api-server',
      type: 'service',
      displayName: 'API Server',
      description: 'Express.js REST API server',
      codeRefs: [{ path: 'src/index.ts', role: 'SOURCE' }],
      children: [],
    },
    {
      id: 'main-db',
      type: 'database',
      displayName: 'Main Database',
      description: 'PostgreSQL database for application data',
      codeRefs: [],
      children: [],
    },
  ],
  edges: [
    {
      from: 'api-server',
      to: 'main-db',
      type: 'SYNC',
      label: 'Reads/writes application data',
    },
  ],
};

/** Valid step 1 response */
const VALID_STEP1_RESPONSE = {
  components: [
    {
      id: 'api-server',
      name: 'API Server',
      role: 'Handles HTTP requests',
      technology: 'Express.js',
      keyFiles: ['src/index.ts'],
    },
    {
      id: 'main-db',
      name: 'Main Database',
      role: 'Stores application data',
      technology: 'PostgreSQL',
      keyFiles: [],
    },
  ],
  systemOverview: 'A simple Express web application with a PostgreSQL database',
};

/** Valid step 2 response */
const VALID_STEP2_RESPONSE = {
  relationships: [
    {
      from: 'api-server',
      to: 'main-db',
      type: 'SYNC' as const,
      label: 'SQL queries',
      protocol: 'TCP',
    },
  ],
};

function createMockSender(
  responses: string | string[],
): AIMessageSender {
  const responseArray = Array.isArray(responses) ? [...responses] : [responses];
  let callIndex = 0;

  return {
    sendMessage: vi.fn(async (opts) => {
      const response = responseArray[Math.min(callIndex, responseArray.length - 1)];
      callIndex++;

      // If onChunk is provided, simulate streaming
      if (opts.onChunk && opts.stream) {
        opts.onChunk(response);
      }

      return {
        content: response,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }),
  };
}

function createFailingSender(
  failCount: number,
  successResponse: string,
): AIMessageSender {
  let callCount = 0;
  return {
    sendMessage: vi.fn(async () => {
      callCount++;
      if (callCount <= failCount) {
        throw new Error(`AI request failed (attempt ${callCount})`);
      }
      return {
        content: successResponse,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('extractJson', () => {
  it('extracts JSON from plain text', () => {
    const input = '{"key": "value"}';
    expect(JSON.parse(extractJson(input))).toEqual({ key: 'value' });
  });

  it('extracts JSON from markdown code fence', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(JSON.parse(extractJson(input))).toEqual({ key: 'value' });
  });

  it('extracts JSON from code fence without language tag', () => {
    const input = '```\n{"key": "value"}\n```';
    expect(JSON.parse(extractJson(input))).toEqual({ key: 'value' });
  });

  it('extracts JSON object from text with surrounding content', () => {
    const input = 'Here is the result:\n{"key": "value"}\nDone!';
    expect(JSON.parse(extractJson(input))).toEqual({ key: 'value' });
  });

  it('handles nested objects', () => {
    const input = '{"nodes": [{"id": "a", "children": []}], "edges": []}';
    const parsed = JSON.parse(extractJson(input));
    expect(parsed.nodes[0].id).toBe('a');
  });

  it('returns trimmed text when no JSON found', () => {
    const input = '  no json here  ';
    expect(extractJson(input)).toBe('no json here');
  });
});

describe('batchFiles', () => {
  const makeFile = (name: string, contentLength: number): SelectedFile => ({
    path: name,
    content: 'x'.repeat(contentLength),
    tier: 1 as const,
    reason: 'test',
  });

  it('returns single batch when files fit within limit', () => {
    const files = [makeFile('a.ts', 400), makeFile('b.ts', 400)]; // 200 tokens total
    const batches = batchFiles(files, 500);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it('splits files into multiple batches when exceeding limit', () => {
    const files = [makeFile('a.ts', 400), makeFile('b.ts', 400), makeFile('c.ts', 400)];
    // Each file is 100 tokens, limit is 150 tokens per batch
    const batches = batchFiles(files, 150);
    expect(batches.length).toBeGreaterThan(1);
  });

  it('puts oversized file in its own batch', () => {
    const files = [makeFile('small.ts', 40), makeFile('huge.ts', 4000), makeFile('small2.ts', 40)];
    const batches = batchFiles(files, 100); // limit 100 tokens
    // huge.ts alone is 1000 tokens > 100, gets own batch
    expect(batches.some((b) => b.length === 1 && b[0].path === 'huge.ts')).toBe(true);
  });

  it('returns empty array for empty input', () => {
    const batches = batchFiles([], 1000);
    expect(batches).toHaveLength(0);
  });

  it('handles single file', () => {
    const files = [makeFile('only.ts', 100)];
    const batches = batchFiles(files, 1000);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
  });
});

describe('mergeResults', () => {
  it('returns single result unchanged', () => {
    const result = mergeResults([VALID_QUICK_RESPONSE]);
    expect(result).toEqual(VALID_QUICK_RESPONSE);
  });

  it('merges nodes from multiple results, deduplicating by id', () => {
    const result1: InferenceResult = {
      ...VALID_QUICK_RESPONSE,
      nodes: [VALID_QUICK_RESPONSE.nodes[0]],
      edges: [],
    };
    const result2: InferenceResult = {
      ...VALID_QUICK_RESPONSE,
      nodes: [
        VALID_QUICK_RESPONSE.nodes[0], // duplicate
        VALID_QUICK_RESPONSE.nodes[1], // new
      ],
      edges: [],
    };

    const merged = mergeResults([result1, result2]);
    expect(merged.nodes).toHaveLength(2);
  });

  it('merges edges, deduplicating by from→to→type', () => {
    const result1: InferenceResult = {
      ...VALID_QUICK_RESPONSE,
      edges: [VALID_QUICK_RESPONSE.edges[0]],
    };
    const result2: InferenceResult = {
      ...VALID_QUICK_RESPONSE,
      edges: [
        VALID_QUICK_RESPONSE.edges[0], // duplicate
        { from: 'main-db', to: 'api-server', type: 'DATA_FLOW', label: 'Read replica' },
      ],
    };

    const merged = mergeResults([result1, result2]);
    expect(merged.edges).toHaveLength(2);
  });

  it('uses architecture name from first result', () => {
    const result1: InferenceResult = { ...VALID_QUICK_RESPONSE, architectureName: 'First' };
    const result2: InferenceResult = { ...VALID_QUICK_RESPONSE, architectureName: 'Second' };
    const merged = mergeResults([result1, result2]);
    expect(merged.architectureName).toBe('First');
  });

  it('throws on empty results array', () => {
    expect(() => mergeResults([])).toThrow('No results to merge');
  });
});

describe('inferenceResultSchema', () => {
  it('validates a correct inference result', () => {
    const result = inferenceResultSchema.safeParse(VALID_QUICK_RESPONSE);
    expect(result.success).toBe(true);
  });

  it('rejects missing architectureName', () => {
    const invalid = { ...VALID_QUICK_RESPONSE, architectureName: '' };
    const result = inferenceResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty nodes array', () => {
    const invalid = { ...VALID_QUICK_RESPONSE, nodes: [] };
    const result = inferenceResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid edge type', () => {
    const invalid = {
      ...VALID_QUICK_RESPONSE,
      edges: [{ from: 'a', to: 'b', type: 'INVALID', label: 'test' }],
    };
    const result = inferenceResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts nodes with children (recursive)', () => {
    const withChildren = {
      ...VALID_QUICK_RESPONSE,
      nodes: [
        {
          ...VALID_QUICK_RESPONSE.nodes[0],
          children: [
            {
              id: 'child-1',
              type: 'function',
              displayName: 'Handler',
              description: 'Request handler',
              codeRefs: [],
              children: [],
            },
          ],
        },
      ],
    };
    const result = inferenceResultSchema.safeParse(withChildren);
    expect(result.success).toBe(true);
  });

  it('defaults edges to empty array when omitted', () => {
    const noEdges = {
      architectureName: 'Test',
      architectureDescription: 'Test app',
      nodes: [VALID_QUICK_RESPONSE.nodes[0]],
    };
    const result = inferenceResultSchema.safeParse(noEdges);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.edges).toEqual([]);
    }
  });

  it('validates code ref roles', () => {
    const withCodeRefs = {
      ...VALID_QUICK_RESPONSE,
      nodes: [
        {
          ...VALID_QUICK_RESPONSE.nodes[0],
          codeRefs: [
            { path: 'src/index.ts', role: 'SOURCE' },
            { path: 'api.yaml', role: 'API_SPEC' },
            { path: 'schema.prisma', role: 'SCHEMA' },
            { path: 'Dockerfile', role: 'DEPLOYMENT' },
            { path: 'config.json', role: 'CONFIG' },
            { path: 'test.ts', role: 'TEST' },
          ],
        },
      ],
    };
    const result = inferenceResultSchema.safeParse(withCodeRefs);
    expect(result.success).toBe(true);
  });

  it('rejects invalid code ref role', () => {
    const invalid = {
      ...VALID_QUICK_RESPONSE,
      nodes: [
        {
          ...VALID_QUICK_RESPONSE.nodes[0],
          codeRefs: [{ path: 'src/index.ts', role: 'INVALID_ROLE' }],
        },
      ],
    };
    const result = inferenceResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('inferArchitecture', () => {
  describe('quick mode', () => {
    it('returns a valid inference result', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      const result = await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'quick',
      });

      expect(result.architectureName).toBe('Test Express App');
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('calls sendMessage once for single batch', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'quick' });
      expect(sender.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('includes project profile in prompt', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'quick' });

      const call = (sender.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const userMessage = call.messages[0].content;
      expect(userMessage).toContain('TypeScript');
      expect(userMessage).toContain('React');
    });

    it('includes built-in node types in prompt', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'quick' });

      const call = (sender.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const userMessage = call.messages[0].content;
      expect(userMessage).toContain('service');
      expect(userMessage).toContain('database');
      expect(userMessage).toContain('message-queue');
      expect(userMessage).toContain('cache');
    });

    it('includes file contents in prompt', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      const keyFiles = makeKeyFiles([
        { path: 'src/app.ts', content: 'const app = express();', tier: 2, reason: 'Entry point' },
      ]);
      await inferArchitecture(sender, makeProfile(), keyFiles, { depth: 'quick' });

      const call = (sender.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('const app = express()');
    });

    it('handles JSON wrapped in markdown code fences', async () => {
      const wrappedResponse = '```json\n' + JSON.stringify(VALID_QUICK_RESPONSE) + '\n```';
      const sender = createMockSender(wrappedResponse);
      const result = await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'quick',
      });
      expect(result.nodes).toHaveLength(2);
    });

    it('emits progress events', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      const events: InferenceProgressEvent[] = [];

      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'quick',
        onProgress: (e) => events.push(e),
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].description).toContain('quick mode');
    });

    it('passes onChunk for streaming', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      const chunks: string[] = [];

      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'quick',
        onChunk: (text) => chunks.push(text),
      });

      const call = (sender.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.stream).toBe(true);
      expect(call.onChunk).toBeDefined();
    });
  });

  describe('standard mode (multi-step)', () => {
    it('makes 3 AI calls for the 3 analysis steps', async () => {
      const sender = createMockSender([
        JSON.stringify(VALID_STEP1_RESPONSE),
        JSON.stringify(VALID_STEP2_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE),
      ]);

      const result = await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'standard',
      });

      expect(sender.sendMessage).toHaveBeenCalledTimes(3);
      expect(result.architectureName).toBe('Test Express App');
    });

    it('emits progress events for each step', async () => {
      const sender = createMockSender([
        JSON.stringify(VALID_STEP1_RESPONSE),
        JSON.stringify(VALID_STEP2_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE),
      ]);
      const events: InferenceProgressEvent[] = [];

      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'standard',
        onProgress: (e) => events.push(e),
      });

      // Should have at least events for steps 1, 2, 3 (some steps emit twice - start + completion)
      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events.some((e) => e.description.includes('Step 1/3'))).toBe(true);
      expect(events.some((e) => e.description.includes('Step 2/3'))).toBe(true);
      expect(events.some((e) => e.description.includes('Step 3/3'))).toBe(true);
    });

    it('includes partial results in progress events', async () => {
      const sender = createMockSender([
        JSON.stringify(VALID_STEP1_RESPONSE),
        JSON.stringify(VALID_STEP2_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE),
      ]);
      const events: InferenceProgressEvent[] = [];

      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'standard',
        onProgress: (e) => events.push(e),
      });

      const step1Complete = events.find(
        (e) => e.step === 1 && e.partialResult,
      );
      expect(step1Complete?.partialResult?.architectureDescription).toBeDefined();
    });

    it('defaults to standard mode when no depth specified', async () => {
      const sender = createMockSender([
        JSON.stringify(VALID_STEP1_RESPONSE),
        JSON.stringify(VALID_STEP2_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE),
      ]);

      await inferArchitecture(sender, makeProfile(), makeKeyFiles());
      // Standard mode makes 3 calls
      expect(sender.sendMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('deep mode', () => {
    it('makes 4 AI calls (3 standard + 1 refinement)', async () => {
      const sender = createMockSender([
        JSON.stringify(VALID_STEP1_RESPONSE),
        JSON.stringify(VALID_STEP2_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE), // refinement response
      ]);

      const result = await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'deep',
      });

      expect(sender.sendMessage).toHaveBeenCalledTimes(4);
      expect(result.architectureName).toBe('Test Express App');
    });

    it('emits step 4 refinement progress event', async () => {
      const sender = createMockSender([
        JSON.stringify(VALID_STEP1_RESPONSE),
        JSON.stringify(VALID_STEP2_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE),
        JSON.stringify(VALID_QUICK_RESPONSE),
      ]);
      const events: InferenceProgressEvent[] = [];

      await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'deep',
        onProgress: (e) => events.push(e),
      });

      expect(events.some((e) => e.description.includes('Step 4/4'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws InferenceError on invalid JSON response', async () => {
      const sender = createMockSender('not valid json at all');

      await expect(
        inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'quick' }),
      ).rejects.toThrow(InferenceError);

      try {
        await inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'quick' });
      } catch (e) {
        expect((e as InferenceError).code).toBe('PARSE_ERROR');
      }
    });

    it('throws InferenceError on schema validation failure', async () => {
      // Valid JSON but invalid schema (missing nodes)
      const sender = createMockSender(JSON.stringify({ architectureName: 'Test' }));

      await expect(
        inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'quick' }),
      ).rejects.toThrow(InferenceError);
    });

    it('includes raw response in parse errors', async () => {
      const badJson = 'this is bad json';
      const sender = createMockSender(badJson);

      try {
        await inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'quick' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as InferenceError).rawResponse).toBe(badJson);
      }
    });

    it('retries on AI failure with exponential backoff', async () => {
      const sender = createFailingSender(2, JSON.stringify(VALID_QUICK_RESPONSE));

      const result = await inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
        depth: 'quick',
        maxRetries: 3,
      });

      expect(result.architectureName).toBe('Test Express App');
      expect(sender.sendMessage).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    }, 15000);

    it('fails after max retries exceeded', async () => {
      const sender = createFailingSender(5, JSON.stringify(VALID_QUICK_RESPONSE));

      await expect(
        inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
          depth: 'quick',
          maxRetries: 2,
        }),
      ).rejects.toThrow('AI request failed after 3 attempts');
    }, 15000);

    it('respects abort signal', async () => {
      const controller = new AbortController();
      controller.abort(); // Abort immediately

      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      // Override sendMessage to check signal
      sender.sendMessage = vi.fn(async (opts) => {
        if (opts.signal?.aborted) {
          throw new Error('Aborted');
        }
        return { content: '', stopReason: null, usage: { inputTokens: 0, outputTokens: 0 } };
      });

      await expect(
        inferArchitecture(sender, makeProfile(), makeKeyFiles(), {
          depth: 'quick',
          signal: controller.signal,
        }),
      ).rejects.toThrow('aborted');
    });

    it('throws InferenceError for step 1 validation failure in standard mode', async () => {
      // Step 1 returns valid JSON but wrong schema
      const sender = createMockSender(JSON.stringify({ wrong: 'schema' }));

      await expect(
        inferArchitecture(sender, makeProfile(), makeKeyFiles(), { depth: 'standard' }),
      ).rejects.toThrow(InferenceError);
    });
  });

  describe('token batching', () => {
    it('handles multiple batches in quick mode by merging results', async () => {
      // Create files that exceed per-call token limit
      const largeFiles: SelectedFile[] = [
        { path: 'a.ts', content: 'x'.repeat(800), tier: 1, reason: 'test' }, // 200 tokens
        { path: 'b.ts', content: 'x'.repeat(800), tier: 2, reason: 'test' }, // 200 tokens
      ];
      const keyFiles = makeKeyFiles(largeFiles);

      const result1: InferenceResult = {
        architectureName: 'Test App',
        architectureDescription: 'First batch',
        nodes: [{ id: 'svc-a', type: 'service', displayName: 'Service A', description: 'A', codeRefs: [], children: [] }],
        edges: [],
      };
      const result2: InferenceResult = {
        architectureName: 'Test App',
        architectureDescription: 'Second batch',
        nodes: [{ id: 'db-b', type: 'database', displayName: 'DB B', description: 'B', codeRefs: [], children: [] }],
        edges: [],
      };

      const sender = createMockSender([
        JSON.stringify(result1),
        JSON.stringify(result2),
      ]);

      const result = await inferArchitecture(sender, makeProfile(), keyFiles, {
        depth: 'quick',
        tokenLimitPerCall: 150, // Force batching (each file is 200 tokens)
      });

      // Both nodes should be present in merged result
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.find((n) => n.id === 'svc-a')).toBeDefined();
      expect(result.nodes.find((n) => n.id === 'db-b')).toBeDefined();
    });
  });

  describe('project profile formatting', () => {
    it('includes infra signals in prompt', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      const profile = makeProfile({
        infraSignals: [{ type: 'docker', evidence: 'Dockerfile' }],
      });

      await inferArchitecture(sender, profile, makeKeyFiles(), { depth: 'quick' });

      const call = (sender.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('docker');
    });

    it('includes data stores in prompt', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      const profile = makeProfile({
        dataStores: [{ type: 'Prisma', evidence: 'schema.prisma' }],
      });

      await inferArchitecture(sender, profile, makeKeyFiles(), { depth: 'quick' });

      const call = (sender.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.messages[0].content).toContain('Prisma');
    });

    it('handles empty profile gracefully', async () => {
      const sender = createMockSender(JSON.stringify(VALID_QUICK_RESPONSE));
      const emptyProfile: ProjectProfile = {
        languages: [],
        frameworks: [],
        projectType: 'unknown',
        buildSystems: [],
        infraSignals: [],
        dataStores: [],
        entryPoints: [],
      };

      const result = await inferArchitecture(sender, emptyProfile, makeKeyFiles(), {
        depth: 'quick',
      });
      expect(result.nodes).toHaveLength(2);
    });
  });
});
