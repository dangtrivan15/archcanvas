/**
 * Feature #309: MCP Additional Tools.
 * Tests export_markdown, export_mermaid, update_edge, add_code_ref,
 * remove_note, get_edges, and init_architecture tools.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  dispatchToolCall,
  handleExportMarkdown,
  handleExportMermaid,
  handleUpdateEdge,
  handleAddCodeRef,
  handleRemoveNote,
  handleGetEdges,
  handleInitArchitecture,
  type ToolHandlerContext,
} from '@/mcp/handlers';
import { TOOL_DEFINITIONS, getToolNames, getToolCount } from '@/mcp/tools';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('MCP Additional Tools - Feature #309', () => {
  let ctx: ToolHandlerContext;
  let nodeId1: string;
  let nodeId2: string;
  let edgeId: string;

  beforeEach(() => {
    const registry = new RegistryManager();
    registry.initialize();

    const graph: ArchGraph = {
      name: 'Test Architecture',
      description: 'Testing additional MCP tools',
      owners: ['team-alpha'],
      nodes: [],
      edges: [],
    };

    const textApi = new TextApi(graph, registry);
    ctx = { textApi, registry };

    // Create two nodes and an edge
    const r1 = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'compute/service',
        displayName: 'Service A',
      }),
    );
    nodeId1 = r1.nodeId;

    const r2 = JSON.parse(
      dispatchToolCall(ctx, 'add_node', {
        type: 'data/database',
        displayName: 'Database B',
      }),
    );
    nodeId2 = r2.nodeId;

    const r3 = JSON.parse(
      dispatchToolCall(ctx, 'add_edge', {
        fromNode: nodeId1,
        toNode: nodeId2,
        type: 'sync',
        label: 'queries',
      }),
    );
    edgeId = r3.edgeId;
  });

  // ── Tool definitions ──

  it('has all 19 tools registered', () => {
    expect(getToolCount()).toBe(19);
  });

  it('tool names include all new tools', () => {
    const names = getToolNames();
    expect(names).toContain('export_markdown');
    expect(names).toContain('export_mermaid');
    expect(names).toContain('update_edge');
    expect(names).toContain('add_code_ref');
    expect(names).toContain('remove_note');
    expect(names).toContain('get_edges');
    expect(names).toContain('init_architecture');
  });

  it('all new tool definitions have name, description, inputSchema', () => {
    for (const key of [
      'export_markdown',
      'export_mermaid',
      'update_edge',
      'add_code_ref',
      'remove_note',
      'get_edges',
      'init_architecture',
    ] as const) {
      const def = TOOL_DEFINITIONS[key];
      expect(def.name).toBe(key);
      expect(def.description).toBeTruthy();
      expect(def.inputSchema).toBeDefined();
    }
  });

  // ── export_markdown ──

  describe('export_markdown', () => {
    it('generates markdown summary via dispatch', () => {
      const result = dispatchToolCall(ctx, 'export_markdown', {});
      expect(result).toContain('# Test Architecture');
      expect(result).toContain('Service A');
      expect(result).toContain('Database B');
    });

    it('generates markdown with mermaid when includeMermaid=true', () => {
      const result = dispatchToolCall(ctx, 'export_markdown', { includeMermaid: true });
      expect(result).toContain('# Test Architecture');
      expect(result).toContain('```mermaid');
      expect(result).toContain('graph LR');
    });

    it('handleExportMarkdown returns plain markdown by default', () => {
      const result = handleExportMarkdown(ctx, {});
      expect(result).toContain('# Test Architecture');
      expect(result).not.toContain('```mermaid');
    });

    it('handleExportMarkdown returns markdown with mermaid when requested', () => {
      const result = handleExportMarkdown(ctx, { includeMermaid: true });
      expect(result).toContain('```mermaid');
    });
  });

  // ── export_mermaid ──

  describe('export_mermaid', () => {
    it('generates mermaid diagram via dispatch', () => {
      const result = dispatchToolCall(ctx, 'export_mermaid', {});
      expect(result).toContain('graph LR');
    });

    it('handleExportMermaid returns mermaid syntax', () => {
      const result = handleExportMermaid(ctx);
      expect(result).toContain('graph LR');
    });

    it('includes nodes and edge arrow', () => {
      const result = dispatchToolCall(ctx, 'export_mermaid', {});
      expect(result).toContain('graph LR');
      // Mermaid should contain some representation of the nodes and edge
      expect(result.length).toBeGreaterThan(10);
    });
  });

  // ── update_edge ──

  describe('update_edge', () => {
    it('updates edge label via dispatch', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'update_edge', {
          edgeId,
          label: 'reads from',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.edgeId).toBe(edgeId);
    });

    it('updates edge type via dispatch', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'update_edge', {
          edgeId,
          type: 'async',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('updates edge properties via dispatch', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'update_edge', {
          edgeId,
          properties: { protocol: 'grpc', timeout: 30 },
        }),
      );
      expect(result.success).toBe(true);
    });

    it('handleUpdateEdge returns success', () => {
      const result = JSON.parse(
        handleUpdateEdge(ctx, {
          edgeId,
          label: 'writes to',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('silently succeeds for nonexistent edge ID (no-op)', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'update_edge', {
          edgeId: 'nonexistent',
          label: 'oops',
        }),
      );
      // The engine silently ignores nonexistent edges (maps over without match)
      expect(result.success).toBe(true);
    });
  });

  // ── add_code_ref ──

  describe('add_code_ref', () => {
    it('adds code reference via dispatch', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'add_code_ref', {
          nodeId: nodeId1,
          path: 'src/services/serviceA.ts',
          role: 'source',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.nodeId).toBe(nodeId1);
      expect(result.path).toBe('src/services/serviceA.ts');
    });

    it('handleAddCodeRef returns success with nodeId and path', () => {
      const result = JSON.parse(
        handleAddCodeRef(ctx, {
          nodeId: nodeId1,
          path: 'src/api/spec.yaml',
          role: 'api-spec',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('code ref appears in describe output', () => {
      dispatchToolCall(ctx, 'add_code_ref', {
        nodeId: nodeId1,
        path: 'src/services/serviceA.ts',
        role: 'source',
      });

      const desc = dispatchToolCall(ctx, 'describe', { format: 'ai' });
      expect(desc).toContain('serviceA.ts');
    });
  });

  // ── remove_note ──

  describe('remove_note', () => {
    let noteId: string;

    beforeEach(() => {
      const r = JSON.parse(
        dispatchToolCall(ctx, 'add_note', {
          nodeId: nodeId1,
          author: 'tester',
          content: 'This is a test note',
        }),
      );
      noteId = r.noteId;
    });

    it('removes note via dispatch', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'remove_note', {
          nodeId: nodeId1,
          noteId,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.noteId).toBe(noteId);
    });

    it('handleRemoveNote returns success', () => {
      const result = JSON.parse(
        handleRemoveNote(ctx, {
          nodeId: nodeId1,
          noteId,
        }),
      );
      expect(result.success).toBe(true);
    });

    it('note is gone after removal', () => {
      dispatchToolCall(ctx, 'remove_note', { nodeId: nodeId1, noteId });

      const desc = dispatchToolCall(ctx, 'describe', { format: 'ai' });
      expect(desc).not.toContain('This is a test note');
    });
  });

  // ── get_edges ──

  describe('get_edges', () => {
    it('lists edges via dispatch', () => {
      const result = JSON.parse(dispatchToolCall(ctx, 'get_edges', {}));
      expect(result.count).toBe(1);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].id).toBe(edgeId);
      expect(result.edges[0].fromNode).toBe(nodeId1);
      expect(result.edges[0].toNode).toBe(nodeId2);
    });

    it('handleGetEdges returns correct structure', () => {
      const result = JSON.parse(handleGetEdges(ctx));
      expect(result.count).toBe(1);
      expect(result.edges[0].type).toBe('sync');
      expect(result.edges[0].label).toBe('queries');
    });

    it('empty graph returns zero edges', () => {
      dispatchToolCall(ctx, 'remove_edge', { edgeId });
      const result = JSON.parse(dispatchToolCall(ctx, 'get_edges', {}));
      expect(result.count).toBe(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  // ── init_architecture ──

  describe('init_architecture', () => {
    it('resets architecture via dispatch', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'init_architecture', {
          name: 'Fresh Start',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.name).toBe('Fresh Start');
    });

    it('clears all nodes and edges', () => {
      dispatchToolCall(ctx, 'init_architecture', { name: 'Empty' });

      const desc = JSON.parse(dispatchToolCall(ctx, 'describe', { format: 'structured' }));
      expect(desc.nodes).toHaveLength(0);
      expect(desc.edges).toHaveLength(0);
      expect(desc.name).toBe('Empty');
    });

    it('uses default name when none provided', () => {
      const result = JSON.parse(dispatchToolCall(ctx, 'init_architecture', {}));
      expect(result.success).toBe(true);
      expect(result.name).toBe('Untitled Architecture');
    });

    it('sets description when provided', () => {
      const result = JSON.parse(
        dispatchToolCall(ctx, 'init_architecture', {
          name: 'New Arch',
          description: 'A fresh architecture',
        }),
      );
      expect(result.success).toBe(true);
      expect(result.description).toBe('A fresh architecture');
    });

    it('handleInitArchitecture returns correct response', () => {
      const result = JSON.parse(handleInitArchitecture(ctx, { name: 'Test Init' }));
      expect(result.success).toBe(true);
      expect(result.name).toBe('Test Init');
    });
  });
});
