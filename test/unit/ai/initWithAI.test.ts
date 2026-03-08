/**
 * Tests for Feature #476: Built-in AI initialization flow (API key path)
 *
 * Validates:
 * - initWithAI orchestrates: scan → detect → select → prompt → agentic loop → result
 * - MCP tool handlers are wired to TextApi correctly
 * - Progress events are emitted in the correct phases and order
 * - Tool call logs track nodes, edges, and code refs created
 * - Error handling: API failures, malformed tool calls, rate limits
 * - Abort/cancellation propagation
 * - Graph is built correctly via mock tool_use responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolCallLog } from '@/ai/agentLoop';

// ── Mock modules ────────────────────────────────────────────────────────────

// Mock the scanner
const mockScanResult = {
  fileTree: {
    root: {
      name: 'test-project',
      relativePath: '.',
      files: [
        { name: 'package.json', relativePath: 'package.json', extension: '.json', sizeBytes: 500 },
        { name: 'index.ts', relativePath: 'index.ts', extension: '.ts', sizeBytes: 200 },
      ],
      directories: [
        {
          name: 'src',
          relativePath: 'src',
          files: [
            { name: 'app.ts', relativePath: 'src/app.ts', extension: '.ts', sizeBytes: 300 },
          ],
          directories: [],
        },
      ],
    },
  },
  totalFiles: 3,
  totalDirs: 1,
  languageBreakdown: { '.ts': 2, '.json': 1 },
};

vi.mock('@/analyze/browserScanner', () => ({
  scanDirectoryBrowser: vi.fn().mockResolvedValue(mockScanResult),
}));

const mockProfile = {
  projectType: 'web-app',
  languages: [{ name: 'TypeScript', percentage: 80 }],
  frameworks: [{ name: 'React', confidence: 'high', evidence: 'package.json' }],
  dataStores: [],
  infraSignals: [],
  entryPoints: ['src/app.ts'],
};

vi.mock('@/analyze/detector', () => ({
  detectProject: vi.fn().mockReturnValue(mockProfile),
}));

const mockKeyFiles = {
  files: [
    { path: 'package.json', content: '{"name":"test"}', tier: 1, reason: 'config' },
    { path: 'src/app.ts', content: 'export const app = {};', tier: 2, reason: 'entry' },
  ],
  totalTokenEstimate: 500,
};

vi.mock('@/analyze/browserFileSelector', () => ({
  selectKeyFilesBrowser: vi.fn().mockResolvedValue(mockKeyFiles),
}));

// Mock the prompt builders
vi.mock('@/ai/prompts/initArchitecture', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('System prompt'),
  buildUserPrompt: vi.fn().mockReturnValue('User prompt'),
}));

// Mock the agent loop
const mockRunAgentLoop = vi.fn();
vi.mock('@/ai/agentLoop', () => ({
  runAgentLoop: (...args: unknown[]) => mockRunAgentLoop(...args),
}));

// Mock MCP tools and handlers
vi.mock('@/mcp/tools', () => ({
  TOOL_DEFINITIONS: {
    add_node: {
      name: 'add_node',
      description: 'Add a node',
      inputSchema: {},
    },
    add_edge: {
      name: 'add_edge',
      description: 'Add an edge',
      inputSchema: {},
    },
    add_code_ref: {
      name: 'add_code_ref',
      description: 'Add a code ref',
      inputSchema: {},
    },
    describe: {
      name: 'describe',
      description: 'Describe architecture',
      inputSchema: {},
    },
    init_architecture: {
      name: 'init_architecture',
      description: 'Init architecture',
      inputSchema: {},
    },
    search: {
      name: 'search',
      description: 'Search',
      inputSchema: {},
    },
    get_edges: {
      name: 'get_edges',
      description: 'Get edges',
      inputSchema: {},
    },
    list_nodedefs: {
      name: 'list_nodedefs',
      description: 'List node defs',
      inputSchema: {},
    },
    export_markdown: {
      name: 'export_markdown',
      description: 'Export markdown',
      inputSchema: {},
    },
    export_mermaid: {
      name: 'export_mermaid',
      description: 'Export mermaid',
      inputSchema: {},
    },
    update_node: {
      name: 'update_node',
      description: 'Update a node',
      inputSchema: {},
    },
    update_edge: {
      name: 'update_edge',
      description: 'Update an edge',
      inputSchema: {},
    },
    remove_node: {
      name: 'remove_node',
      description: 'Remove a node',
      inputSchema: {},
    },
    remove_edge: {
      name: 'remove_edge',
      description: 'Remove an edge',
      inputSchema: {},
    },
    remove_note: {
      name: 'remove_note',
      description: 'Remove a note',
      inputSchema: {},
    },
    add_note: {
      name: 'add_note',
      description: 'Add a note',
      inputSchema: {},
    },
    // These should NOT be included in the agentic loop:
    save: {
      name: 'save',
      description: 'Save',
      inputSchema: {},
    },
    file_info: {
      name: 'file_info',
      description: 'File info',
      inputSchema: {},
    },
    analyze_codebase: {
      name: 'analyze_codebase',
      description: 'Analyze codebase',
      inputSchema: {},
    },
  },
}));

vi.mock('@/mcp/handlers', () => ({
  dispatchToolCall: vi.fn().mockReturnValue('{"success":true}'),
}));

// ── Test setup ──────────────────────────────────────────────────────────────

// Fake Anthropic client (only needed as a passthrough to runAgentLoop)
const fakeClient = {} as import('@anthropic-ai/sdk').default;

// Fake DirectoryHandle
const fakeDirHandle = { name: 'test-project' } as FileSystemDirectoryHandle;

// Fake TextApi
function createFakeTextApi() {
  return {
    getGraph: vi.fn().mockReturnValue({
      name: 'test-project',
      nodes: [
        { id: 'n1', displayName: 'API', codeRefs: [{ path: 'src/api.ts', role: 'source' }] },
        { id: 'n2', displayName: 'DB', codeRefs: [] },
      ],
      edges: [{ id: 'e1', fromNode: 'n1', toNode: 'n2' }],
    }),
    setGraph: vi.fn(),
  } as unknown as import('@/api/textApi').TextApi;
}

// Fake registry
const fakeRegistry = {
  listNamespaces: vi.fn().mockReturnValue(['compute']),
  listByNamespace: vi.fn().mockReturnValue([]),
  listAll: vi.fn().mockReturnValue([]),
} as unknown as import('@/core/registry/registryManager').RegistryManager;

// Default agent loop response
function makeAgentLoopResult(overrides?: Partial<import('@/ai/agentLoop').AgentLoopResult>) {
  return {
    response: 'Architecture graph built successfully.',
    toolCalls: [
      { name: 'init_architecture', input: { name: 'test-project' }, result: '{"success":true}', isError: false },
      { name: 'add_node', input: { type: 'compute/service', displayName: 'API' }, result: '{"success":true,"nodeId":"n1"}', isError: false },
      { name: 'add_node', input: { type: 'data/database', displayName: 'DB' }, result: '{"success":true,"nodeId":"n2"}', isError: false },
      { name: 'add_edge', input: { fromNode: 'n1', toNode: 'n2', type: 'sync' }, result: '{"success":true}', isError: false },
      { name: 'add_code_ref', input: { nodeId: 'n1', path: 'src/api.ts', role: 'source' }, result: '{"success":true}', isError: false },
    ] as ToolCallLog[],
    iterations: 3,
    hitMaxIterations: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRunAgentLoop.mockResolvedValue(makeAgentLoopResult());
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('initWithAI', () => {
  async function getInitWithAI() {
    const mod = await import('@/ai/initWithAI');
    return mod.initWithAI;
  }

  it('should orchestrate scan → detect → select → build flow', async () => {
    const initWithAI = await getInitWithAI();
    const result = await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    expect(result.graph).toBeDefined();
    expect(result.graph.name).toBe('test-project');
    expect(result.stats.nodes).toBe(2);
    expect(result.stats.edges).toBe(1);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('should pass project metadata to buildUserPrompt', async () => {
    const initWithAI = await getInitWithAI();
    const { buildUserPrompt } = await import('@/ai/prompts/initArchitecture');

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
      architectureName: 'My Project',
    });

    expect(buildUserPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Project',
        keyFiles: expect.arrayContaining([
          expect.objectContaining({ path: 'package.json' }),
        ]),
        languages: expect.arrayContaining([
          expect.objectContaining({ name: 'TypeScript' }),
        ]),
        frameworks: expect.arrayContaining(['React']),
      }),
    );
  });

  it('should pass registry to buildSystemPrompt', async () => {
    const initWithAI = await getInitWithAI();
    const { buildSystemPrompt } = await import('@/ai/prompts/initArchitecture');

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    expect(buildSystemPrompt).toHaveBeenCalledWith(fakeRegistry);
  });

  it('should pass correct options to runAgentLoop', async () => {
    const initWithAI = await getInitWithAI();

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 8192,
      maxIterations: 25,
    });

    expect(mockRunAgentLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
        client: fakeClient,
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        maxIterations: 25,
      }),
    );
  });

  it('should emit progress events in correct phase order', async () => {
    const initWithAI = await getInitWithAI();
    const progressEvents: Array<{ phase: string; percent: number }> = [];

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
      onProgress: (event) => {
        progressEvents.push({ phase: event.phase, percent: event.percent });
      },
    });

    // Should start with scanning
    expect(progressEvents[0]?.phase).toBe('scanning');
    expect(progressEvents[0]?.percent).toBe(5);

    // Should progress through phases
    const phases = progressEvents.map((e) => e.phase);
    expect(phases).toContain('scanning');
    expect(phases).toContain('detecting');
    expect(phases).toContain('selecting');
    expect(phases).toContain('prompting');
    expect(phases).toContain('building');
    expect(phases).toContain('complete');

    // Last event should be 'complete' at 100%
    const lastEvent = progressEvents[progressEvents.length - 1];
    expect(lastEvent?.phase).toBe('complete');
    expect(lastEvent?.percent).toBe(100);

    // Percentages should be monotonically non-decreasing
    for (let i = 1; i < progressEvents.length; i++) {
      expect(progressEvents[i]!.percent).toBeGreaterThanOrEqual(progressEvents[i - 1]!.percent);
    }
  });

  it('should track tool calls via onToolCall callback', async () => {
    const initWithAI = await getInitWithAI();
    const toolCalls: ToolCallLog[] = [];

    // Make the agent loop invoke the onToolCall callback
    mockRunAgentLoop.mockImplementation(async (opts: { onToolCall?: (log: ToolCallLog) => void }) => {
      const logs: ToolCallLog[] = [
        { name: 'add_node', input: { displayName: 'API' }, result: '{"success":true}', isError: false },
        { name: 'add_edge', input: { fromNode: 'n1', toNode: 'n2' }, result: '{"success":true}', isError: false },
      ];
      for (const log of logs) {
        opts.onToolCall?.(log);
      }
      return makeAgentLoopResult({ toolCalls: logs });
    });

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
      onToolCall: (log) => toolCalls.push(log),
    });

    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0]?.name).toBe('add_node');
    expect(toolCalls[1]?.name).toBe('add_edge');
  });

  it('should emit building progress events for each tool call', async () => {
    const initWithAI = await getInitWithAI();
    const buildingEvents: Array<{ message: string; percent: number }> = [];

    mockRunAgentLoop.mockImplementation(async (opts: { onToolCall?: (log: ToolCallLog) => void }) => {
      opts.onToolCall?.({ name: 'add_node', input: {}, result: '{}', isError: false });
      opts.onToolCall?.({ name: 'add_edge', input: {}, result: '{}', isError: false });
      opts.onToolCall?.({ name: 'add_code_ref', input: {}, result: '{}', isError: false });
      return makeAgentLoopResult();
    });

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
      onProgress: (event) => {
        if (event.phase === 'building' && event.detail?.toolName) {
          buildingEvents.push({ message: event.message, percent: event.percent });
        }
      },
    });

    expect(buildingEvents.length).toBe(3);
    // Should show incrementing counts
    expect(buildingEvents[0]?.message).toContain('1 nodes');
    expect(buildingEvents[1]?.message).toContain('1 edges');
    expect(buildingEvents[2]?.message).toContain('1 code refs');
  });

  it('should return tool call log from agentic loop', async () => {
    const initWithAI = await getInitWithAI();
    const result = await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    expect(result.toolCalls).toHaveLength(5);
    expect(result.toolCalls[0]?.name).toBe('init_architecture');
    expect(result.iterations).toBe(3);
    expect(result.hitMaxIterations).toBe(false);
  });

  it('should include warnings for error tool calls', async () => {
    const initWithAI = await getInitWithAI();

    mockRunAgentLoop.mockResolvedValue(makeAgentLoopResult({
      toolCalls: [
        { name: 'add_node', input: {}, result: '{"success":true}', isError: false },
        { name: 'add_edge', input: {}, result: '{"error":"invalid node ID"}', isError: true },
      ],
    }));

    const result = await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    expect(result.warnings).toContainEqual(
      expect.stringContaining('Tool error (add_edge)'),
    );
  });

  it('should add warning when hitting max iterations', async () => {
    const initWithAI = await getInitWithAI();

    mockRunAgentLoop.mockResolvedValue(makeAgentLoopResult({
      hitMaxIterations: true,
      iterations: 50,
    }));

    const result = await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    expect(result.hitMaxIterations).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('max iteration guard'),
    );
  });

  it('should throw on abort signal', async () => {
    const initWithAI = await getInitWithAI();
    const controller = new AbortController();
    controller.abort();

    await expect(
      initWithAI({
        directoryHandle: fakeDirHandle,
        client: fakeClient,
        textApi: createFakeTextApi(),
        registry: fakeRegistry,
        signal: controller.signal,
      }),
    ).rejects.toThrow('Pipeline aborted');
  });

  it('should propagate scan errors gracefully', async () => {
    const initWithAI = await getInitWithAI();
    const { scanDirectoryBrowser } = await import('@/analyze/browserScanner');
    vi.mocked(scanDirectoryBrowser).mockRejectedValueOnce(new Error('Permission denied'));

    await expect(
      initWithAI({
        directoryHandle: fakeDirHandle,
        client: fakeClient,
        textApi: createFakeTextApi(),
        registry: fakeRegistry,
      }),
    ).rejects.toThrow('Scan failed: Permission denied');
  });

  it('should propagate detection errors gracefully', async () => {
    const initWithAI = await getInitWithAI();
    const { detectProject } = await import('@/analyze/detector');
    vi.mocked(detectProject).mockImplementationOnce(() => {
      throw new Error('Detection crash');
    });

    await expect(
      initWithAI({
        directoryHandle: fakeDirHandle,
        client: fakeClient,
        textApi: createFakeTextApi(),
        registry: fakeRegistry,
      }),
    ).rejects.toThrow('Detection failed: Detection crash');
  });

  it('should propagate file selection errors gracefully', async () => {
    const initWithAI = await getInitWithAI();
    const { selectKeyFilesBrowser } = await import('@/analyze/browserFileSelector');
    vi.mocked(selectKeyFilesBrowser).mockRejectedValueOnce(new Error('Read error'));

    await expect(
      initWithAI({
        directoryHandle: fakeDirHandle,
        client: fakeClient,
        textApi: createFakeTextApi(),
        registry: fakeRegistry,
      }),
    ).rejects.toThrow('File selection failed: Read error');
  });

  it('should use folder name as default architecture name', async () => {
    const initWithAI = await getInitWithAI();
    const { buildUserPrompt } = await import('@/ai/prompts/initArchitecture');

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
      // No architectureName specified — should use dirHandle.name
    });

    expect(buildUserPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-project' }),
    );
  });

  it('should return project profile in result', async () => {
    const initWithAI = await getInitWithAI();
    const result = await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    expect(result.projectProfile).toBeDefined();
    expect(result.projectProfile.projectType).toBe('web-app');
    expect(result.projectProfile.languages[0]?.name).toBe('TypeScript');
  });

  it('should count code refs from actual graph nodes', async () => {
    const initWithAI = await getInitWithAI();
    const result = await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    // Our fake graph has 1 code ref on node n1
    expect(result.stats.codeRefs).toBe(1);
  });

  it('should pass AbortSignal to runAgentLoop', async () => {
    const initWithAI = await getInitWithAI();
    const controller = new AbortController();

    // Don't abort — just verify the signal is passed through
    mockRunAgentLoop.mockResolvedValue(makeAgentLoopResult());

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
      signal: controller.signal,
    });

    expect(mockRunAgentLoop).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe('tool registry filtering', () => {
  it('should exclude save, file_info, and analyze_codebase tools', async () => {
    const { initWithAI } = await import('@/ai/initWithAI');

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    // Get the tool registry that was passed to runAgentLoop
    const callArgs = mockRunAgentLoop.mock.calls[0]?.[0];
    const toolRegistry = callArgs?.toolRegistry as Map<string, unknown>;

    expect(toolRegistry).toBeDefined();
    expect(toolRegistry.has('add_node')).toBe(true);
    expect(toolRegistry.has('add_edge')).toBe(true);
    expect(toolRegistry.has('describe')).toBe(true);
    expect(toolRegistry.has('init_architecture')).toBe(true);

    // These should be excluded
    expect(toolRegistry.has('save')).toBe(false);
    expect(toolRegistry.has('file_info')).toBe(false);
    expect(toolRegistry.has('analyze_codebase')).toBe(false);
  });

  it('should wire tool handlers to dispatchToolCall', async () => {
    const { initWithAI } = await import('@/ai/initWithAI');
    const { dispatchToolCall } = await import('@/mcp/handlers');

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    // Get the tool registry
    const callArgs = mockRunAgentLoop.mock.calls[0]?.[0];
    const toolRegistry = callArgs?.toolRegistry as Map<string, { handler: (input: Record<string, unknown>) => string }>;
    const addNodeEntry = toolRegistry.get('add_node');

    expect(addNodeEntry).toBeDefined();

    // Call the handler — should delegate to dispatchToolCall
    const input = { type: 'compute/service', displayName: 'Test' };
    addNodeEntry!.handler(input);

    expect(dispatchToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ textApi: expect.anything(), registry: expect.anything() }),
      'add_node',
      input,
    );
  });
});

describe('directory listing builder', () => {
  it('should build tree output from scan result', async () => {
    const { initWithAI } = await import('@/ai/initWithAI');
    const { buildUserPrompt } = await import('@/ai/prompts/initArchitecture');

    await initWithAI({
      directoryHandle: fakeDirHandle,
      client: fakeClient,
      textApi: createFakeTextApi(),
      registry: fakeRegistry,
    });

    const metadata = vi.mocked(buildUserPrompt).mock.calls[0]?.[0];
    expect(metadata).toBeDefined();
    expect(metadata!.directoryListing).toContain('package.json');
    expect(metadata!.directoryListing).toContain('src/');
    expect(metadata!.directoryListing).toContain('index.ts');
  });
});
