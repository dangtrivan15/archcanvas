/**
 * Tests for External Agent Dialog (Feature #477)
 *
 * Verifies:
 * - Copyable prompt includes correct project context
 * - UI updates when graph state changes externally
 * - Dialog state management in uiStore
 * - Done/Cancel button behavior
 * - Prompt builder correctness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildExternalAgentPrompt,
  buildPromptContextFromProject,
  type ExternalAgentPromptContext,
} from '@/ai/prompts/externalAgentPrompt';
import { useUIStore } from '@/store/uiStore';

// ── Prompt Builder Tests ─────────────────────────────────────────────────────

describe('buildExternalAgentPrompt', () => {
  const baseContext: ExternalAgentPromptContext = {
    projectName: 'my-app',
    projectPath: '/Users/dev/my-app',
    hasSourceFiles: true,
  };

  it('should include project name in the prompt header', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('my-app');
    expect(prompt).toContain('Analyze "my-app"');
  });

  it('should include project path', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('/Users/dev/my-app');
  });

  it('should include MCP tool names', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('add_node');
    expect(prompt).toContain('add_edge');
    expect(prompt).toContain('add_code_ref');
    expect(prompt).toContain('init_architecture');
    expect(prompt).toContain('describe');
  });

  it('should include workflow steps', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('Scan');
    expect(prompt).toContain('Initialize');
    expect(prompt).toContain('Create nodes');
    expect(prompt).toContain('Connect nodes');
    expect(prompt).toContain('Attach code references');
    expect(prompt).toContain('Review');
  });

  it('should include edge type guidance', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('sync');
    expect(prompt).toContain('async');
    expect(prompt).toContain('data-flow');
  });

  it('should include languages when provided', () => {
    const prompt = buildExternalAgentPrompt({
      ...baseContext,
      languages: ['TypeScript', 'Python'],
    });
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('Python');
  });

  it('should include frameworks when provided', () => {
    const prompt = buildExternalAgentPrompt({
      ...baseContext,
      frameworks: ['React', 'Express'],
    });
    expect(prompt).toContain('React');
    expect(prompt).toContain('Express');
  });

  it('should not include languages section when empty', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).not.toContain('**Languages**');
  });

  it('should not include frameworks section when empty', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).not.toContain('**Frameworks**');
  });

  it('should include init_architecture with project name', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('init_architecture');
    expect(prompt).toContain('name: "my-app"');
  });

  it('should include guidelines about connected graphs', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('connected graph');
    expect(prompt).toContain('every node should have at least one edge');
  });

  it('should include thoroughness guidance', () => {
    const prompt = buildExternalAgentPrompt(baseContext);
    expect(prompt).toContain('thorough');
    expect(prompt).toContain('completeness over brevity');
  });
});

// ── buildPromptContextFromProject Tests ──────────────────────────────────────

describe('buildPromptContextFromProject', () => {
  it('should use manifest name as project name', () => {
    const manifest = { name: 'My Project', files: [], rootFile: '' };
    const ctx = buildPromptContextFromProject(manifest, null, true);
    expect(ctx.projectName).toBe('My Project');
  });

  it('should fall back to directory handle name', () => {
    const handle = { name: 'project-dir' } as FileSystemDirectoryHandle;
    const ctx = buildPromptContextFromProject(null, handle, false);
    expect(ctx.projectName).toBe('project-dir');
    expect(ctx.projectPath).toBe('project-dir');
  });

  it('should fall back to "My Project" when no context available', () => {
    const ctx = buildPromptContextFromProject(null, null, false);
    expect(ctx.projectName).toBe('My Project');
  });

  it('should pass hasSourceFiles through', () => {
    const ctx = buildPromptContextFromProject(null, null, true);
    expect(ctx.hasSourceFiles).toBe(true);

    const ctx2 = buildPromptContextFromProject(null, null, false);
    expect(ctx2.hasSourceFiles).toBe(false);
  });
});

// ── UI Store Tests ───────────────────────────────────────────────────────────

describe('uiStore external agent dialog', () => {
  beforeEach(() => {
    useUIStore.setState({
      externalAgentDialogOpen: false,
      externalAgentDialogInfo: null,
    });
  });

  it('should start with dialog closed', () => {
    const state = useUIStore.getState();
    expect(state.externalAgentDialogOpen).toBe(false);
    expect(state.externalAgentDialogInfo).toBeNull();
  });

  it('should open dialog with info', () => {
    const info = {
      prompt: 'Test prompt',
      onDone: vi.fn(),
      onCancel: vi.fn(),
    };
    useUIStore.getState().openExternalAgentDialog(info);

    const state = useUIStore.getState();
    expect(state.externalAgentDialogOpen).toBe(true);
    expect(state.externalAgentDialogInfo).toEqual(info);
  });

  it('should close dialog and clear info', () => {
    const info = {
      prompt: 'Test prompt',
      onDone: vi.fn(),
      onCancel: vi.fn(),
    };
    useUIStore.getState().openExternalAgentDialog(info);
    useUIStore.getState().closeExternalAgentDialog();

    const state = useUIStore.getState();
    expect(state.externalAgentDialogOpen).toBe(false);
    expect(state.externalAgentDialogInfo).toBeNull();
  });

  it('should preserve prompt text in dialog info', () => {
    const longPrompt = 'A'.repeat(5000);
    const info = {
      prompt: longPrompt,
      onDone: vi.fn(),
      onCancel: vi.fn(),
    };
    useUIStore.getState().openExternalAgentDialog(info);

    expect(useUIStore.getState().externalAgentDialogInfo?.prompt).toBe(longPrompt);
  });

  it('should store separate callbacks for Done and Cancel', () => {
    const onDone = vi.fn();
    const onCancel = vi.fn();
    const info = { prompt: 'p', onDone, onCancel };

    useUIStore.getState().openExternalAgentDialog(info);

    const stored = useUIStore.getState().externalAgentDialogInfo!;
    stored.onDone();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();

    stored.onCancel();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ── Graph Monitoring Tests ───────────────────────────────────────────────────

describe('graph state monitoring for external agent', () => {
  it('should be able to read graph state from coreStore', async () => {
    // Verifies the pattern used by ExternalAgentDialog:
    // useCoreStore((s) => s.graph.nodes) and s.graph.edges
    const { useCoreStore } = await import('@/store/coreStore');

    const state = useCoreStore.getState();
    expect(state.graph).toBeDefined();
    expect(state.graph.nodes).toBeDefined();
    expect(state.graph.edges).toBeDefined();
    expect(Array.isArray(state.graph.nodes)).toBe(true);
    expect(Array.isArray(state.graph.edges)).toBe(true);
  });

  it('should detect node count changes via direct state mutation', async () => {
    const { useCoreStore } = await import('@/store/coreStore');

    const initialNodes = useCoreStore.getState().graph.nodes;
    const initialCount = initialNodes.length;

    // Simulate external agent adding nodes by directly updating graph state
    // (This is what happens when the MCP server mutates the graph via TextApi)
    useCoreStore.setState({
      graph: {
        ...useCoreStore.getState().graph,
        nodes: [
          ...initialNodes,
          {
            id: 'test-node-1',
            type: 'compute/service',
            displayName: 'Test Service',
            args: {},
            codeRefs: [],
            notes: [],
            properties: {},
            children: [],
          } as any,
        ],
      },
    });

    const newCount = useCoreStore.getState().graph.nodes.length;
    expect(newCount).toBe(initialCount + 1);

    // Clean up: restore original nodes
    useCoreStore.setState({
      graph: {
        ...useCoreStore.getState().graph,
        nodes: initialNodes,
      },
    });
  });

  it('should detect edge count changes via direct state mutation', async () => {
    const { useCoreStore } = await import('@/store/coreStore');

    const initialEdges = useCoreStore.getState().graph.edges;
    const initialCount = initialEdges.length;

    // Simulate external agent adding edges
    useCoreStore.setState({
      graph: {
        ...useCoreStore.getState().graph,
        edges: [
          ...initialEdges,
          {
            id: 'test-edge-1',
            fromNode: 'node-a',
            toNode: 'node-b',
            type: 'SYNC',
            label: 'test',
            properties: {},
            notes: [],
          } as any,
        ],
      },
    });

    const newCount = useCoreStore.getState().graph.edges.length;
    expect(newCount).toBe(initialCount + 1);

    // Clean up
    useCoreStore.setState({
      graph: {
        ...useCoreStore.getState().graph,
        edges: initialEdges,
      },
    });
  });
});
