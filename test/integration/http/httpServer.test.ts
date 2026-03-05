/**
 * HTTP API Integration Tests (Feature #315).
 *
 * Tests the HTTP REST server:
 *   - CRUD: create architecture via POST, read via GET, verify consistency
 *   - Auto-save: mutation → restart server → verify data persisted
 *   - Error responses: 404 for missing nodes, 400 for invalid input
 *   - Concurrent access: multiple agents hitting the server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHttpServer, type HttpServerOptions } from '@/cli/server/httpServer';
import { GraphContext } from '@/cli/context';
import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Helper: start HTTP server on a random-ish port
async function startServer(
  ctx: GraphContext,
  port = 0,
): Promise<{ server: Server; baseUrl: string }> {
  const options: HttpServerOptions = { port, host: '127.0.0.1', cors: false };
  const server = createHttpServer(ctx, options);

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
      } else {
        reject(new Error('Could not get server address'));
      }
    });
  });
}

// Helper: close server
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

// Helper: HTTP request
async function httpRequest(
  url: string,
  method = 'GET',
  body?: unknown,
): Promise<{ status: number; data: unknown; text: string }> {
  const opts: RequestInit = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };
  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: resp.status, data, text };
}

describe('HTTP API Integration', () => {
  let tmpDir: string;
  let archcFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archcanvas-http-integration-'));
    archcFile = path.join(tmpDir, 'test.archc');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── Step 1: CRUD via HTTP ───

  it('creates architecture via POST, reads via GET, verifies consistency', async () => {
    const ctx = GraphContext.createNew('HTTP CRUD Test');
    await ctx.saveAs(archcFile);
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const { server, baseUrl } = await startServer(reloaded);

    try {
      // Health check
      const health = await httpRequest(`${baseUrl}/health`);
      expect(health.status).toBe(200);
      expect((health.data as Record<string, unknown>).status).toBe('ok');

      // Info (query routes use { data, meta } envelope)
      const info = await httpRequest(`${baseUrl}/api/info`);
      expect(info.status).toBe(200);
      const infoEnv = info.data as { data: Record<string, unknown>; meta: Record<string, unknown> };
      expect(infoEnv.data.name).toBe('HTTP CRUD Test');
      expect(infoEnv.meta.timestamp).toBeDefined();

      // Create node 1
      const create1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'WebAPI',
      });
      expect(create1.status).toBe(201);
      const node1 = create1.data as Record<string, unknown>;
      expect(node1.id).toBeDefined();
      expect(node1.displayName).toBe('WebAPI');

      // Create node 2
      const create2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'data/database',
        displayName: 'PostgresDB',
      });
      expect(create2.status).toBe(201);
      const node2 = create2.data as Record<string, unknown>;

      // List nodes (envelope)
      const listNodes = await httpRequest(`${baseUrl}/api/nodes`);
      expect(listNodes.status).toBe(200);
      const nodesEnv = listNodes.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      const nodes = nodesEnv.data;
      expect(nodes).toHaveLength(2);
      expect(nodesEnv.meta.count).toBe(2);

      // Get specific node (envelope)
      const getNode = await httpRequest(`${baseUrl}/api/nodes/${node1.id}`);
      expect(getNode.status).toBe(200);
      expect((getNode.data as { data: Record<string, unknown> }).data.displayName).toBe('WebAPI');

      // Create edge
      const createEdge = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: node1.id,
        toNode: node2.id,
        type: 'sync',
        label: 'SQL queries',
      });
      expect(createEdge.status).toBe(201);
      const edge = createEdge.data as Record<string, unknown>;
      expect(edge.id).toBeDefined();

      // List edges (envelope)
      const listEdges = await httpRequest(`${baseUrl}/api/edges`);
      expect(listEdges.status).toBe(200);
      const edgesEnv = listEdges.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      const edges = edgesEnv.data;
      expect(edges).toHaveLength(1);

      // Update node
      const updateNode = await httpRequest(`${baseUrl}/api/nodes/${node1.id}`, 'PATCH', {
        displayName: 'UpdatedWebAPI',
      });
      expect(updateNode.status).toBe(200);

      // Verify update (envelope)
      const getUpdated = await httpRequest(`${baseUrl}/api/nodes/${node1.id}`);
      expect((getUpdated.data as { data: Record<string, unknown> }).data.displayName).toBe(
        'UpdatedWebAPI',
      );

      // Add note
      const addNote = await httpRequest(`${baseUrl}/api/nodes/${node1.id}/notes`, 'POST', {
        content: 'Test note for HTTP integration',
        author: 'integration-test',
      });
      expect(addNote.status).toBe(201);
      const note = addNote.data as Record<string, unknown>;
      expect(note.id).toBeDefined();

      // Delete edge
      const deleteEdge = await httpRequest(`${baseUrl}/api/edges/${edge.id}`, 'DELETE');
      expect(deleteEdge.status).toBe(204);

      // Verify edge deleted (envelope)
      const listEdgesAfter = await httpRequest(`${baseUrl}/api/edges`);
      expect((listEdgesAfter.data as { data: Array<unknown> }).data).toHaveLength(0);

      // Delete node
      const deleteNode = await httpRequest(`${baseUrl}/api/nodes/${node2.id}`, 'DELETE');
      expect(deleteNode.status).toBe(204);

      // Verify node deleted (envelope)
      const listNodesAfter = await httpRequest(`${baseUrl}/api/nodes`);
      expect((listNodesAfter.data as { data: Array<unknown> }).data).toHaveLength(1);

      // Search (envelope)
      const search = await httpRequest(`${baseUrl}/api/search?q=Updated`);
      expect(search.status).toBe(200);
      const searchEnv = search.data as { data: Array<unknown>; meta: Record<string, unknown> };
      expect(searchEnv.data.length).toBeGreaterThan(0);
      expect(searchEnv.meta.query).toBe('Updated');

      // Export markdown
      const exportMd = await httpRequest(`${baseUrl}/api/export/markdown`);
      expect(exportMd.status).toBe(200);
      expect(exportMd.text).toContain('UpdatedWebAPI');

      // Export mermaid
      const exportMermaid = await httpRequest(`${baseUrl}/api/export/mermaid`);
      expect(exportMermaid.status).toBe(200);
      expect(typeof exportMermaid.text).toBe('string');

      // Describe (envelope with scope/format params)
      const desc = await httpRequest(`${baseUrl}/api/describe?format=structured`);
      expect(desc.status).toBe(200);
      const descEnv = desc.data as { data: unknown; meta: Record<string, unknown> };
      expect(descEnv.meta.format).toBe('structured');
      expect(descEnv.meta.scope).toBe('full');

      // Describe backward compat with style param
      const descStyle = await httpRequest(`${baseUrl}/api/describe?style=human`);
      expect(descStyle.status).toBe(200);
    } finally {
      await closeServer(server);
    }
  });

  // ─── Step 2: Auto-save — mutation → close → reload → verify ───

  it('mutations auto-save to .archc file and persist across server restarts', async () => {
    const ctx = GraphContext.createNew('AutoSave Test');
    await ctx.saveAs(archcFile);
    const ctx1 = await GraphContext.loadFromFile(archcFile);
    const { server: server1, baseUrl: baseUrl1 } = await startServer(ctx1);

    let nodeId: string;
    try {
      // Create a node via HTTP
      const create = await httpRequest(`${baseUrl1}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'AutoSaveNode',
      });
      expect(create.status).toBe(201);
      nodeId = (create.data as Record<string, unknown>).id as string;
    } finally {
      await closeServer(server1);
    }

    // Reload from file and start a new server
    const ctx2 = await GraphContext.loadFromFile(archcFile);
    const { server: server2, baseUrl: baseUrl2 } = await startServer(ctx2);

    try {
      // Verify node persisted (envelope)
      const listNodes = await httpRequest(`${baseUrl2}/api/nodes`);
      expect(listNodes.status).toBe(200);
      const nodesEnv = listNodes.data as { data: Array<Record<string, unknown>> };
      const nodes = nodesEnv.data;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].displayName).toBe('AutoSaveNode');
      expect(nodes[0].id).toBe(nodeId);
    } finally {
      await closeServer(server2);
    }
  });

  // ─── Step 3: Error responses ───

  describe('Error responses', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      const ctx = GraphContext.createNew('Error Test');
      await ctx.saveAs(archcFile);
      const reloaded = await GraphContext.loadFromFile(archcFile);
      const s = await startServer(reloaded);
      server = s.server;
      baseUrl = s.baseUrl;
    });

    afterEach(async () => {
      await closeServer(server);
    });

    it('returns 404 for non-existent node', async () => {
      const result = await httpRequest(`${baseUrl}/api/nodes/nonexistent-id-999`);
      expect(result.status).toBe(404);
      expect((result.data as Record<string, unknown>).error).toContain('not found');
    });

    it('returns 404 for non-existent route', async () => {
      const result = await httpRequest(`${baseUrl}/api/nonexistent`);
      expect(result.status).toBe(404);
    });

    it('returns 400 for POST nodes without required fields', async () => {
      const result = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {});
      expect(result.status).toBe(400);
      expect((result.data as Record<string, unknown>).error).toContain('type');
    });

    it('returns 400 for POST edges without required fields', async () => {
      const result = await httpRequest(`${baseUrl}/api/edges`, 'POST', {});
      expect(result.status).toBe(400);
      expect((result.data as Record<string, unknown>).error).toContain('fromNode');
    });

    it('returns 400 for search without query', async () => {
      const result = await httpRequest(`${baseUrl}/api/search`);
      expect(result.status).toBe(400);
      const errData = result.data as Record<string, unknown>;
      expect(errData.error).toContain('q');
    });

    it('returns 400 for describe with scope=node but no nodeId', async () => {
      const result = await httpRequest(`${baseUrl}/api/describe?scope=node`);
      expect(result.status).toBe(400);
      const errData = result.data as Record<string, unknown>;
      expect(errData.error).toContain('nodeId');
    });

    it('returns 204 for deleting non-existent node (no-op, filter-based removal)', async () => {
      // removeNode uses filter — non-existent IDs are silently ignored
      const result = await httpRequest(`${baseUrl}/api/nodes/fake-id`, 'DELETE');
      expect(result.status).toBe(204);
    });

    it('returns 204 for deleting non-existent edge (no-op, filter-based removal)', async () => {
      // removeEdge uses filter — non-existent IDs are silently ignored
      const result = await httpRequest(`${baseUrl}/api/edges/fake-id`, 'DELETE');
      expect(result.status).toBe(204);
    });

    it('returns 400 for PATCH node without body', async () => {
      // First create a node
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'TestNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id;

      // PATCH with empty body (no JSON at all)
      const resp = await fetch(`${baseUrl}/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      // Should get 400 since body is empty/undefined
      expect(resp.status).toBe(400);
    });

    it('returns 400 for POST notes without content', async () => {
      // Create a node
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'NoteTarget',
      });
      const nodeId = (create.data as Record<string, unknown>).id;

      const result = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/notes`, 'POST', {});
      expect(result.status).toBe(400);
      expect((result.data as Record<string, unknown>).error).toContain('content');
    });
  });

  // ─── Step 4: Concurrent access patterns ───

  it('handles concurrent requests from multiple agents', async () => {
    const ctx = GraphContext.createNew('Concurrent Test');
    await ctx.saveAs(archcFile);
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const { server, baseUrl } = await startServer(reloaded);

    try {
      // Fire multiple concurrent POST requests to create nodes
      const promises = Array.from({ length: 5 }, (_, i) =>
        httpRequest(`${baseUrl}/api/nodes`, 'POST', {
          type: 'compute/service',
          displayName: `ConcurrentNode_${i}`,
        }),
      );

      const results = await Promise.all(promises);

      // All should succeed
      for (const result of results) {
        expect(result.status).toBe(201);
        expect((result.data as Record<string, unknown>).id).toBeDefined();
      }

      // Verify all nodes were created (envelope)
      const listResult = await httpRequest(`${baseUrl}/api/nodes`);
      const nodesEnv = listResult.data as { data: Array<Record<string, unknown>> };
      const nodes = nodesEnv.data;
      expect(nodes).toHaveLength(5);

      // All IDs should be unique
      const ids = nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(5);

      // Fire concurrent reads while writing
      const mixedPromises = [
        httpRequest(`${baseUrl}/api/nodes`, 'POST', {
          type: 'data/database',
          displayName: 'ConcurrentDB',
        }),
        httpRequest(`${baseUrl}/api/nodes`),
        httpRequest(`${baseUrl}/api/describe?style=structured`),
        httpRequest(`${baseUrl}/api/search?q=Concurrent`),
        httpRequest(`${baseUrl}/health`),
      ];

      const mixedResults = await Promise.all(mixedPromises);
      // All should succeed (no 500 errors)
      for (const result of mixedResults) {
        expect(result.status).toBeLessThan(500);
      }
    } finally {
      await closeServer(server);
    }
  });

  // ─── Step 5: Query endpoint envelope and features (Feature #311) ───

  describe('Query endpoints (Feature #311)', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      const ctx = GraphContext.createNew('Query Test');
      await ctx.saveAs(archcFile);
      const reloaded = await GraphContext.loadFromFile(archcFile);

      // Add some nodes to work with
      reloaded.textApi.addNode({ type: 'compute/service', displayName: 'AuthService' });
      const dbNode = reloaded.textApi.addNode({ type: 'data/database', displayName: 'UserDB' });
      reloaded.textApi.addNode({ type: 'messaging/message-queue', displayName: 'EventQueue' });
      reloaded.textApi.addEdge({
        fromNode: reloaded.textApi.listNodes()[0].id,
        toNode: dbNode.id,
        type: 'sync',
        label: 'SQL',
      });
      await reloaded.save(true);

      const s = await startServer(reloaded);
      server = s.server;
      baseUrl = s.baseUrl;
    });

    afterEach(async () => {
      await closeServer(server);
    });

    it('GET /api/info returns { data, meta } envelope with metadata', async () => {
      const res = await httpRequest(`${baseUrl}/api/info`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Record<string, unknown>; meta: Record<string, unknown> };
      expect(body.data).toBeDefined();
      expect(body.meta).toBeDefined();
      expect(body.meta.timestamp).toBeDefined();
      expect(body.data.name).toBe('Query Test');
      expect(body.data.nodeCount).toBe(3);
      expect(body.data.edgeCount).toBe(1);
    });

    it('GET /api/describe with scope=full and format=structured', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?scope=full&format=structured`);
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(body.data).toBeDefined();
      expect(body.meta.scope).toBe('full');
      expect(body.meta.format).toBe('structured');
    });

    it('GET /api/describe with scope=full and format=human', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?format=human`);
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(typeof body.data).toBe('string');
      expect(body.meta.format).toBe('human');
    });

    it('GET /api/describe with scope=full and format=ai', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?format=ai`);
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(typeof body.data).toBe('string');
      expect(body.meta.format).toBe('ai');
    });

    it('GET /api/describe backward-compatible with ?style= parameter', async () => {
      const res = await httpRequest(`${baseUrl}/api/describe?style=structured`);
      expect(res.status).toBe(200);
      const body = res.data as { data: unknown; meta: Record<string, unknown> };
      expect(body.data).toBeDefined();
    });

    it('GET /api/describe with scope=node and nodeId', async () => {
      // Get a node ID first
      const nodesRes = await httpRequest(`${baseUrl}/api/nodes`);
      const nodesEnv = nodesRes.data as { data: Array<Record<string, unknown>> };
      const nodeId = nodesEnv.data[0].id;

      const res = await httpRequest(
        `${baseUrl}/api/describe?scope=node&nodeId=${nodeId}&format=structured`,
      );
      expect(res.status).toBe(200);
      const body = res.data as { data: string; meta: Record<string, unknown> };
      expect(body.meta.scope).toBe('node');
    });

    it('GET /api/nodes returns NodeSummary[] in envelope with count', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`);
      expect(res.status).toBe(200);
      const body = res.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      expect(body.data).toHaveLength(3);
      expect(body.meta.count).toBe(3);
      // Verify NodeSummary shape
      const node = body.data[0];
      expect(node.id).toBeDefined();
      expect(node.type).toBeDefined();
      expect(node.displayName).toBeDefined();
    });

    it('GET /api/nodes/:id returns NodeDetail in envelope', async () => {
      // Get a node ID
      const nodesRes = await httpRequest(`${baseUrl}/api/nodes`);
      const nodesEnv = nodesRes.data as { data: Array<Record<string, unknown>> };
      const authNode = nodesEnv.data.find((n) => n.displayName === 'AuthService')!;

      const res = await httpRequest(`${baseUrl}/api/nodes/${authNode.id}`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Record<string, unknown>; meta: Record<string, unknown> };
      expect(body.data.displayName).toBe('AuthService');
      expect(body.data.type).toBe('compute/service');
      expect(body.meta.timestamp).toBeDefined();
    });

    it('GET /api/nodes/:id returns 404 for non-existent node', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes/nonexistent-xyz`);
      expect(res.status).toBe(404);
      const body = res.data as { error: string };
      expect(body.error).toContain('not found');
    });

    it('GET /api/edges returns EdgeSummary[] in envelope with count', async () => {
      const res = await httpRequest(`${baseUrl}/api/edges`);
      expect(res.status).toBe(200);
      const body = res.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      expect(body.data).toHaveLength(1);
      expect(body.meta.count).toBe(1);
      // Verify EdgeSummary shape
      const edge = body.data[0];
      expect(edge.id).toBeDefined();
      expect(edge.fromNode).toBeDefined();
      expect(edge.toNode).toBeDefined();
      expect(edge.type).toBeDefined();
    });

    it('GET /api/search?q=<query> returns SearchResult[] in envelope', async () => {
      const res = await httpRequest(`${baseUrl}/api/search?q=Auth`);
      expect(res.status).toBe(200);
      const body = res.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.query).toBe('Auth');
      expect(body.meta.count).toBe(body.data.length);
    });

    it('GET /api/search without q returns 400', async () => {
      const res = await httpRequest(`${baseUrl}/api/search`);
      expect(res.status).toBe(400);
    });

    it('GET /api/nodedefs returns all nodedefs in envelope', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs`);
      expect(res.status).toBe(200);
      const body = res.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.count).toBe(body.data.length);
      // Verify nodedef summary shape
      const def = body.data[0];
      expect(def.type).toBeDefined();
      expect(def.displayName).toBeDefined();
      expect(def.namespace).toBeDefined();
      expect(def.description).toBeDefined();
      expect(def.icon).toBeDefined();
    });

    it('GET /api/nodedefs?namespace=compute filters by namespace', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs?namespace=compute`);
      expect(res.status).toBe(200);
      const body = res.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.namespace).toBe('compute');
      // All should be compute namespace
      for (const def of body.data) {
        expect(def.namespace).toBe('compute');
      }
    });

    it('GET /api/nodedefs?namespace=data filters by data namespace', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs?namespace=data`);
      expect(res.status).toBe(200);
      const body = res.data as {
        data: Array<Record<string, unknown>>;
        meta: Record<string, unknown>;
      };
      expect(body.data.length).toBeGreaterThan(0);
      for (const def of body.data) {
        expect(def.namespace).toBe('data');
      }
    });

    it('GET /api/nodedefs?namespace=nonexistent returns empty array', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodedefs?namespace=nonexistent`);
      expect(res.status).toBe(200);
      const body = res.data as { data: Array<unknown>; meta: Record<string, unknown> };
      expect(body.data).toHaveLength(0);
      expect(body.meta.count).toBe(0);
    });

    it('all query endpoints have consistent { data, meta } envelope', async () => {
      const endpoints = [
        '/api/info',
        '/api/describe',
        '/api/nodes',
        '/api/edges',
        '/api/search?q=test',
        '/api/nodedefs',
      ];

      for (const endpoint of endpoints) {
        const res = await httpRequest(`${baseUrl}${endpoint}`);
        expect(res.status).toBeLessThan(500);
        const body = res.data as Record<string, unknown>;
        expect(body.data).toBeDefined();
        expect(body.meta).toBeDefined();
        expect((body.meta as Record<string, unknown>).timestamp).toBeDefined();
      }
    });
  });

  // ─── Step 6: Export endpoints ───

  it('export endpoints return valid content', async () => {
    const ctx = GraphContext.createNew('Export Test');
    await ctx.saveAs(archcFile);
    const reloaded = await GraphContext.loadFromFile(archcFile);
    const { server, baseUrl } = await startServer(reloaded);

    try {
      // Add some data first
      await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'ExportSvc',
      });

      // Markdown
      const md = await httpRequest(`${baseUrl}/api/export/markdown`);
      expect(md.status).toBe(200);
      expect(md.text).toContain('ExportSvc');

      // Mermaid
      const mermaid = await httpRequest(`${baseUrl}/api/export/mermaid`);
      expect(mermaid.status).toBe(200);
      expect(mermaid.text).toContain('graph');

      // Summary (markdown + mermaid)
      const summary = await httpRequest(`${baseUrl}/api/export/summary`);
      expect(summary.status).toBe(200);
      expect(summary.text).toContain('ExportSvc');
    } finally {
      await closeServer(server);
    }
  });

  // ─── Step 7: Mutation endpoints (Feature #312) ───

  describe('Mutation endpoints (Feature #312)', () => {
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      const ctx = GraphContext.createNew('Mutation Test');
      await ctx.saveAs(archcFile);
      const reloaded = await GraphContext.loadFromFile(archcFile);
      const s = await startServer(reloaded);
      server = s.server;
      baseUrl = s.baseUrl;
    });

    afterEach(async () => {
      await closeServer(server);
    });

    // ── POST /api/nodes ──

    it('POST /api/nodes creates a node with 201 and returns node data', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'MutationTestSvc',
      });
      expect(res.status).toBe(201);
      const data = res.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.type).toBe('compute/service');
      expect(data.displayName).toBe('MutationTestSvc');
    });

    it('POST /api/nodes with position and args', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'data/database',
        displayName: 'TestDB',
        position: { x: 100, y: 200 },
        args: { engine: 'PostgreSQL', version: '16' },
      });
      expect(res.status).toBe(201);
      const data = res.data as Record<string, unknown>;
      expect(data.displayName).toBe('TestDB');
      expect(data.args).toEqual({ engine: 'PostgreSQL', version: '16' });
    });

    it('POST /api/nodes validates required fields (type)', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        displayName: 'NoType',
      });
      expect(res.status).toBe(400);
      expect((res.data as Record<string, unknown>).error).toContain('type');
    });

    it('POST /api/nodes validates required fields (displayName)', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
      });
      expect(res.status).toBe(400);
      expect((res.data as Record<string, unknown>).error).toContain('displayName');
    });

    it('POST /api/nodes rejects empty body', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {});
      expect(res.status).toBe(400);
    });

    // ── PUT /api/nodes/:id ──

    it('PUT /api/nodes/:id updates displayName and returns 200', async () => {
      // Create node first
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'OriginalName',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const update = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`, 'PUT', {
        displayName: 'UpdatedName',
      });
      expect(update.status).toBe(200);
      expect((update.data as Record<string, unknown>).updated).toBe(nodeId);

      // Verify via GET
      const get = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`);
      expect((get.data as { data: Record<string, unknown> }).data.displayName).toBe('UpdatedName');
    });

    it('PUT /api/nodes/:id updates args and properties', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'ArgTestNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const update = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`, 'PUT', {
        args: { runtime: 'Node.js', version: '20' },
        properties: { scaling: 'horizontal' },
      });
      expect(update.status).toBe(200);
    });

    it('PUT /api/nodes/:id updates color via updateNodeColor', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'ColorNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const update = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`, 'PUT', {
        color: '#FF5733',
      });
      expect(update.status).toBe(200);
    });

    it('PUT /api/nodes/:id silently succeeds for non-existent node (no-op)', async () => {
      // updateNode uses map — non-existent IDs are silently ignored
      const update = await httpRequest(`${baseUrl}/api/nodes/nonexistent-xyz`, 'PUT', {
        displayName: 'WontWork',
      });
      expect(update.status).toBe(200);
    });

    it('PUT /api/nodes/:id validates empty update body', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'EmptyUpdateNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const update = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`, 'PUT', {});
      expect(update.status).toBe(400);
    });

    it('PATCH /api/nodes/:id works as alias for PUT', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'PatchTestNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const update = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`, 'PATCH', {
        displayName: 'PatchedName',
      });
      expect(update.status).toBe(200);

      const get = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`);
      expect((get.data as { data: Record<string, unknown> }).data.displayName).toBe('PatchedName');
    });

    // ── DELETE /api/nodes/:id ──

    it('DELETE /api/nodes/:id removes node and returns 204', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'DeleteMe',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const del = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`, 'DELETE');
      expect(del.status).toBe(204);

      // Verify deleted
      const get = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`);
      expect(get.status).toBe(404);
    });

    // ── POST /api/edges ──

    it('POST /api/edges creates edge with 201 and returns edge data', async () => {
      // Create two nodes
      const n1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'EdgeFrom',
      });
      const n2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'data/database',
        displayName: 'EdgeTo',
      });
      const fromId = (n1.data as Record<string, unknown>).id as string;
      const toId = (n2.data as Record<string, unknown>).id as string;

      const res = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: fromId,
        toNode: toId,
        type: 'async',
        label: 'events',
      });
      expect(res.status).toBe(201);
      const data = res.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.fromNode).toBe(fromId);
      expect(data.toNode).toBe(toId);
      expect(data.type).toBe('async');
      expect(data.label).toBe('events');
    });

    it('POST /api/edges with fromPort and toPort', async () => {
      const n1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'PortFrom',
      });
      const n2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'PortTo',
      });
      const fromId = (n1.data as Record<string, unknown>).id as string;
      const toId = (n2.data as Record<string, unknown>).id as string;

      const res = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: fromId,
        toNode: toId,
        type: 'data-flow',
        fromPort: 'out-1',
        toPort: 'in-1',
      });
      expect(res.status).toBe(201);
    });

    it('POST /api/edges validates required fields', async () => {
      const res = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: 'some-id',
      });
      expect(res.status).toBe(400);
      expect((res.data as Record<string, unknown>).error).toContain('toNode');
    });

    it('POST /api/edges defaults type to sync', async () => {
      const n1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'DefaultFrom',
      });
      const n2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'DefaultTo',
      });
      const fromId = (n1.data as Record<string, unknown>).id as string;
      const toId = (n2.data as Record<string, unknown>).id as string;

      const res = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: fromId,
        toNode: toId,
      });
      expect(res.status).toBe(201);
      expect((res.data as Record<string, unknown>).type).toBe('sync');
    });

    // ── PUT /api/edges/:id ──

    it('PUT /api/edges/:id updates edge and returns 200', async () => {
      const n1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'UpdateEdgeFrom',
      });
      const n2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'UpdateEdgeTo',
      });
      const fromId = (n1.data as Record<string, unknown>).id as string;
      const toId = (n2.data as Record<string, unknown>).id as string;

      const createEdge = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: fromId,
        toNode: toId,
        type: 'sync',
        label: 'original',
      });
      const edgeId = (createEdge.data as Record<string, unknown>).id as string;

      const update = await httpRequest(`${baseUrl}/api/edges/${edgeId}`, 'PUT', {
        type: 'async',
        label: 'updated-label',
      });
      expect(update.status).toBe(200);
      expect((update.data as Record<string, unknown>).updated).toBe(edgeId);
    });

    it('PATCH /api/edges/:id works as alias for PUT', async () => {
      const n1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'PatchEdgeFrom',
      });
      const n2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'PatchEdgeTo',
      });
      const fromId = (n1.data as Record<string, unknown>).id as string;
      const toId = (n2.data as Record<string, unknown>).id as string;

      const createEdge = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: fromId,
        toNode: toId,
      });
      const edgeId = (createEdge.data as Record<string, unknown>).id as string;

      const update = await httpRequest(`${baseUrl}/api/edges/${edgeId}`, 'PATCH', {
        label: 'patched',
      });
      expect(update.status).toBe(200);
    });

    // ── DELETE /api/edges/:id ──

    it('DELETE /api/edges/:id removes edge and returns 204', async () => {
      const n1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'DelEdgeFrom',
      });
      const n2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'DelEdgeTo',
      });
      const fromId = (n1.data as Record<string, unknown>).id as string;
      const toId = (n2.data as Record<string, unknown>).id as string;

      const createEdge = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: fromId,
        toNode: toId,
      });
      const edgeId = (createEdge.data as Record<string, unknown>).id as string;

      const del = await httpRequest(`${baseUrl}/api/edges/${edgeId}`, 'DELETE');
      expect(del.status).toBe(204);

      // Verify deleted
      const list = await httpRequest(`${baseUrl}/api/edges`);
      expect((list.data as { data: Array<unknown> }).data).toHaveLength(0);
    });

    // ── POST /api/nodes/:id/notes ──

    it('POST /api/nodes/:id/notes creates note with 201', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'NoteNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const res = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/notes`, 'POST', {
        content: 'This is a test note',
        author: 'test-agent',
        tags: ['review', 'performance'],
      });
      expect(res.status).toBe(201);
      const data = res.data as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.nodeId).toBe(nodeId);
      expect(data.content).toBe('This is a test note');
      expect(data.author).toBe('test-agent');
      expect(data.tags).toEqual(['review', 'performance']);
    });

    it('POST /api/nodes/:id/notes defaults author to http-api', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'DefaultAuthorNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const res = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/notes`, 'POST', {
        content: 'Note with default author',
      });
      expect(res.status).toBe(201);
      expect((res.data as Record<string, unknown>).author).toBe('http-api');
    });

    it('POST /api/nodes/:id/notes validates content is required', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'NoContentNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const res = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/notes`, 'POST', {});
      expect(res.status).toBe(400);
      expect((res.data as Record<string, unknown>).error).toContain('content');
    });

    // ── DELETE /api/nodes/:nid/notes/:noteId ──

    it('DELETE /api/nodes/:nid/notes/:noteId removes note and returns 204', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'DelNoteNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const addNote = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/notes`, 'POST', {
        content: 'Note to delete',
      });
      const noteId = (addNote.data as Record<string, unknown>).id as string;

      const del = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/notes/${noteId}`, 'DELETE');
      expect(del.status).toBe(204);

      // Verify note is gone
      const getNode = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`);
      const nodeData = (getNode.data as { data: Record<string, unknown> }).data;
      const notes = nodeData.notes as Array<unknown>;
      expect(notes).toHaveLength(0);
    });

    // ── POST /api/nodes/:id/code-refs ──

    it('POST /api/nodes/:id/code-refs adds code reference with 201', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'CodeRefNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      const res = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/code-refs`, 'POST', {
        path: 'src/services/auth.ts',
        role: 'source',
      });
      expect(res.status).toBe(201);
      const data = res.data as Record<string, unknown>;
      expect(data.nodeId).toBe(nodeId);
      expect(data.path).toBe('src/services/auth.ts');
      expect(data.role).toBe('source');

      // Verify via GET
      const getNode = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`);
      const nodeData = (getNode.data as { data: Record<string, unknown> }).data;
      const codeRefs = nodeData.codeRefs as Array<Record<string, unknown>>;
      expect(codeRefs).toHaveLength(1);
      expect(codeRefs[0].path).toBe('src/services/auth.ts');
      expect(codeRefs[0].role).toBe('source');
    });

    it('POST /api/nodes/:id/code-refs with different roles', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'MultiRefNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      for (const role of [
        'source',
        'api-spec',
        'schema',
        'deployment',
        'config',
        'test',
      ] as const) {
        const res = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/code-refs`, 'POST', {
          path: `src/${role}/file.ts`,
          role,
        });
        expect(res.status).toBe(201);
      }

      // Verify all 6 code refs
      const getNode = await httpRequest(`${baseUrl}/api/nodes/${nodeId}`);
      const nodeData = (getNode.data as { data: Record<string, unknown> }).data;
      const codeRefs = nodeData.codeRefs as Array<Record<string, unknown>>;
      expect(codeRefs).toHaveLength(6);
    });

    it('POST /api/nodes/:id/code-refs validates required fields', async () => {
      const create = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'ValidateRefNode',
      });
      const nodeId = (create.data as Record<string, unknown>).id as string;

      // Missing role
      const res1 = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/code-refs`, 'POST', {
        path: 'src/foo.ts',
      });
      expect(res1.status).toBe(400);

      // Missing path
      const res2 = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/code-refs`, 'POST', {
        role: 'source',
      });
      expect(res2.status).toBe(400);

      // Invalid role
      const res3 = await httpRequest(`${baseUrl}/api/nodes/${nodeId}/code-refs`, 'POST', {
        path: 'src/foo.ts',
        role: 'invalid-role',
      });
      expect(res3.status).toBe(400);
    });

    // ── Zod validation ──

    it('Zod validation returns descriptive error messages', async () => {
      const res = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 123, // should be string
        displayName: 'TypeMismatch',
      });
      expect(res.status).toBe(400);
      const errData = res.data as Record<string, unknown>;
      expect(errData.error).toContain('Validation error');
    });

    it('Zod validates edge type enum', async () => {
      const n1 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'EnumFrom',
      });
      const n2 = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'EnumTo',
      });
      const fromId = (n1.data as Record<string, unknown>).id as string;
      const toId = (n2.data as Record<string, unknown>).id as string;

      // Invalid edge type
      const res = await httpRequest(`${baseUrl}/api/edges`, 'POST', {
        fromNode: fromId,
        toNode: toId,
        type: 'invalid-type',
      });
      expect(res.status).toBe(400);
      expect((res.data as Record<string, unknown>).error).toContain('Validation error');
    });

    // ── Auto-save and sidecar regeneration ──

    it('mutations auto-save .archc file and data persists', async () => {
      // Create node via server 1
      const createRes = await httpRequest(`${baseUrl}/api/nodes`, 'POST', {
        type: 'compute/service',
        displayName: 'PersistTestNode',
      });
      expect(createRes.status).toBe(201);

      // Close current server
      await closeServer(server);

      // Reload and start new server
      const ctx2 = await GraphContext.loadFromFile(archcFile);
      const { server: server2, baseUrl: baseUrl2 } = await startServer(ctx2);
      server = server2;
      baseUrl = baseUrl2;

      // Verify data persisted
      const list = await httpRequest(`${baseUrl}/api/nodes`);
      const nodes = (list.data as { data: Array<Record<string, unknown>> }).data;
      expect(nodes.some((n) => n.displayName === 'PersistTestNode')).toBe(true);
    });
  });
});
