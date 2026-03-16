/**
 * Standalone bridge server entry point.
 *
 * Runs the AI bridge as an independent HTTP + WebSocket server,
 * decoupled from Vite. Used by the Tauri sidecar for desktop mode.
 *
 * The Claude Agent SDK is imported statically so bun build --compile bundles it.
 * At runtime, the sidecar resolves the user's `claude` CLI path via login shell
 * and passes it to the SDK as pathToClaudeCodeExecutable, avoiding the need for
 * node/bun on PATH to run the SDK's embedded cli.js.
 *
 * Usage: archcanvas-bridge [--port <port>] [--cwd <path>]
 */

import { createBridgeServer } from '../core/ai/bridgeServer.js';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import { execFileSync } from 'child_process';
import { parseCanvas } from '../storage/yamlCodec.js';

// Strip env vars that make the SDK think it's running inside a nested
// Claude Code session. Common when the Tauri app is launched from within
// Claude Code during development.
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;

// Resolve the installed `claude` CLI path. The SDK spawns it as a subprocess.
// We resolve via the user's login shell so it works even when launched from
// Finder (which has a minimal PATH that doesn't include ~/.local/bin).
function resolveClaudePath(): string | undefined {
  const shell = process.env.SHELL || '/bin/zsh';
  try {
    return execFileSync(shell, ['-l', '-c', 'which claude'], { encoding: 'utf-8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

const claudePath = resolveClaudePath();

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

const cliArgs = process.argv.slice(2);
const portIdx = cliArgs.indexOf('--port');
const cwdIdx = cliArgs.indexOf('--cwd');

const port = portIdx !== -1 ? parseInt(cliArgs[portIdx + 1]) : 17248;
const cwd = cwdIdx !== -1 ? cliArgs[cwdIdx + 1] : process.cwd();

// ---------------------------------------------------------------------------
// Create bridge server
// ---------------------------------------------------------------------------

const server = createBridgeServer({ port, cwd, queryFn: wrappedQuery as any });

// ---------------------------------------------------------------------------
// MCP Tool Definitions — 9 tools matching the CLI commands
// ---------------------------------------------------------------------------

const ROOT = '__root__';

function toCallToolResult(result: { ok: boolean; data?: unknown; error?: { code: string; message: string } }) {
  if (result.ok) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(result.error) }], isError: true };
}

const mcpServer = createSdkMcpServer({
  name: 'archcanvas',
  version: '0.1.0',
  tools: [
    // --- Write Tools ---
    tool('add_node', 'Add a node to the architecture canvas', {
      id: z.string().describe('Unique node identifier (kebab-case)'),
      type: z.string().describe('Node type (e.g., compute/service, data/database). Run catalog tool first.'),
      name: z.string().optional().describe('Display name'),
      args: z.string().optional().describe('Constructor arguments as JSON string'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      const result = await server.relayStoreAction('addNode', {
        canvasId: a.scope ?? ROOT,
        id: a.id, type: a.type, name: a.name, args: a.args,
      });
      return toCallToolResult(result);
    }),

    tool('add_edge', 'Add an edge (connection) between two nodes', {
      from: z.string().describe('Source node ID (use @refNodeId/nodeId for cross-scope)'),
      to: z.string().describe('Target node ID'),
      fromPort: z.string().optional().describe('Source port name'),
      toPort: z.string().optional().describe('Target port name'),
      protocol: z.string().optional().describe('Communication protocol (HTTP, gRPC, SQL, etc.)'),
      label: z.string().optional().describe('Edge label'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      const edge = {
        from: { node: a.from, ...(a.fromPort ? { port: a.fromPort } : {}) },
        to: { node: a.to, ...(a.toPort ? { port: a.toPort } : {}) },
        ...(a.protocol ? { protocol: a.protocol } : {}),
        ...(a.label ? { label: a.label } : {}),
      };
      const result = await server.relayStoreAction('addEdge', {
        canvasId: a.scope ?? ROOT, edge,
      });
      return toCallToolResult(result);
    }),

    tool('remove_node', 'Remove a node from the canvas', {
      id: z.string().describe('Node ID to remove'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      const result = await server.relayStoreAction('removeNode', {
        canvasId: a.scope ?? ROOT, nodeId: a.id,
      });
      return toCallToolResult(result);
    }),

    tool('remove_edge', 'Remove an edge between two nodes', {
      from: z.string().describe('Source node ID'),
      to: z.string().describe('Target node ID'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      const result = await server.relayStoreAction('removeEdge', {
        canvasId: a.scope ?? ROOT, from: a.from, to: a.to,
      });
      return toCallToolResult(result);
    }),

    tool('import_yaml', 'Import nodes, edges, and entities from YAML content', {
      yaml: z.string().describe('YAML content to import'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      let parsed;
      try {
        parsed = parseCanvas(a.yaml);
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `YAML parse error: ${err.message}` }], isError: true };
      }
      const result = await server.relayStoreAction('import', {
        canvasId: a.scope ?? ROOT,
        nodes: parsed.data.nodes ?? [],
        edges: parsed.data.edges ?? [],
        entities: parsed.data.entities ?? [],
      });
      return toCallToolResult(result);
    }),

    // --- Read Tools ---
    tool('list', 'List nodes, edges, or entities in a canvas', {
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
      type: z.enum(['nodes', 'edges', 'entities', 'all']).optional().describe('What to list'),
    }, async (a) => {
      const result = await server.relayStoreAction('list', {
        canvasId: a.scope ?? ROOT, type: a.type,
      });
      return toCallToolResult(result);
    }),

    tool('describe', 'Describe a node or the full architecture', {
      id: z.string().optional().describe('Node ID (omit for full architecture overview)'),
      scope: z.string().optional().describe('Canvas scope ID (omit for root)'),
    }, async (a) => {
      const result = await server.relayStoreAction('describe', {
        canvasId: a.scope ?? ROOT, ...(a.id ? { id: a.id } : {}),
      });
      return toCallToolResult(result);
    }),

    tool('search', 'Search for nodes, edges, or entities by query', {
      query: z.string().describe('Search query'),
      type: z.enum(['nodes', 'edges', 'entities']).optional().describe('Filter by type'),
    }, async (a) => {
      const result = await server.relayStoreAction('search', {
        query: a.query, ...(a.type ? { type: a.type } : {}),
      });
      return toCallToolResult(result);
    }),

    tool('catalog', 'List available node types from the registry', {
      namespace: z.string().optional().describe('Filter by namespace (e.g., compute, data)'),
    }, async (a) => {
      const result = await server.relayStoreAction('catalog', {
        ...(a.namespace ? { namespace: a.namespace } : {}),
      });
      return toCallToolResult(result);
    }),
  ],
});

// ---------------------------------------------------------------------------
// MCP tool names for auto-approval
// ---------------------------------------------------------------------------

const MCP_TOOL_NAMES = [
  'mcp__archcanvas__add_node', 'mcp__archcanvas__add_edge',
  'mcp__archcanvas__remove_node', 'mcp__archcanvas__remove_edge',
  'mcp__archcanvas__import_yaml', 'mcp__archcanvas__list',
  'mcp__archcanvas__describe', 'mcp__archcanvas__search',
  'mcp__archcanvas__catalog',
];

// ---------------------------------------------------------------------------
// Wrapped query — injects Claude CLI path, MCP servers, and auto-approved tools
// ---------------------------------------------------------------------------

function wrappedQuery({ prompt, options }: Parameters<typeof query>[0]) {
  return query({
    prompt,
    options: {
      ...options,
      ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
      mcpServers: { archcanvas: mcpServer },
      allowedTools: [...(options?.allowedTools ?? []), ...MCP_TOOL_NAMES],
    },
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const { port: actualPort } = await server.start();

// Structured first line for Tauri sidecar port discovery
console.log(`BRIDGE_PORT=${actualPort}`);

process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
