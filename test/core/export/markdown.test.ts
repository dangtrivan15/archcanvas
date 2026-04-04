import { describe, it, expect } from 'vitest';
import { exportCanvasToMarkdown } from '@/core/export/markdown';
import { makeCanvas, makeNode, makeRefNode, makeEdge, makeEntity } from '../graph/helpers';

describe('exportCanvasToMarkdown', () => {
  // ────────────────────────────────────────────
  // Basic structure
  // ────────────────────────────────────────────

  it('produces a valid Markdown document with title', () => {
    const canvas = makeCanvas({ displayName: 'My Architecture' });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('# My Architecture');
  });

  it('uses "Untitled Canvas" when no displayName', () => {
    const canvas = makeCanvas({});
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('# Untitled Canvas');
  });

  it('uses custom title option over displayName', () => {
    const canvas = makeCanvas({ displayName: 'Original' });
    const md = exportCanvasToMarkdown(canvas, { title: 'Custom Title' });
    expect(md).toContain('# Custom Title');
    expect(md).not.toContain('# Original');
  });

  it('includes description when present', () => {
    const canvas = makeCanvas({ description: 'A description of the architecture.' });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('A description of the architecture.');
  });

  // ────────────────────────────────────────────
  // Table of contents
  // ────────────────────────────────────────────

  it('includes table of contents by default', () => {
    const canvas = makeCanvas({ entities: [makeEntity()] });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('## Table of Contents');
    expect(md).toContain('- [Nodes](#nodes)');
    expect(md).toContain('- [Edges](#edges)');
    expect(md).toContain('- [Entities](#entities)');
  });

  it('omits table of contents when includeToc is false', () => {
    const canvas = makeCanvas({});
    const md = exportCanvasToMarkdown(canvas, { includeToc: false });
    expect(md).not.toContain('## Table of Contents');
  });

  it('omits entities from TOC when no entities exist', () => {
    const canvas = makeCanvas({ entities: [] });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).not.toContain('- [Entities](#entities)');
  });

  // ────────────────────────────────────────────
  // Nodes section
  // ────────────────────────────────────────────

  it('renders an empty nodes message for canvas with no nodes', () => {
    const canvas = makeCanvas({ nodes: [] });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('_No nodes defined._');
  });

  it('renders nodes table with inline nodes', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({ id: 'svc-a', type: 'compute/service', displayName: 'Service A', description: 'Handles requests' }),
        makeNode({ id: 'svc-b', type: 'storage/database' }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('| Name | Type | Description |');
    expect(md).toContain('| Service A | `compute/service` | Handles requests |');
    expect(md).toContain('| svc-b | `storage/database` |');
  });

  it('renders ref nodes with subsystem badge', () => {
    const canvas = makeCanvas({
      nodes: [makeRefNode({ id: 'auth-svc', ref: 'auth-service' })],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('auth-svc (subsystem)');
    expect(md).toContain('`ref:auth-service`');
  });

  it('renders node properties (args)', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({
          id: 'db',
          type: 'storage/database',
          displayName: 'PostgreSQL',
          args: { engine: 'postgres', port: 5432 },
        }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('### PostgreSQL');
    expect(md).toContain('**Properties:**');
    expect(md).toContain('- **engine:** postgres');
    expect(md).toContain('- **port:** 5432');
  });

  it('renders array args as comma-separated', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({
          id: 'svc',
          type: 'compute/service',
          args: { tags: ['api', 'backend'] },
        }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('- **tags:** api, backend');
  });

  it('renders node code references', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({
          id: 'svc',
          type: 'compute/service',
          codeRefs: ['src/services/auth.ts', 'src/services/user.ts'],
        }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('**Code References:**');
    expect(md).toContain('- `src/services/auth.ts`');
    expect(md).toContain('- `src/services/user.ts`');
  });

  it('renders node notes', () => {
    const canvas = makeCanvas({
      nodes: [
        makeNode({
          id: 'svc',
          type: 'compute/service',
          notes: [
            { author: 'Alice', content: 'Needs rate limiting' },
            { author: 'Bob', content: 'Add caching layer' },
          ],
        }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('**Notes:**');
    expect(md).toContain('> **Alice:** Needs rate limiting');
    expect(md).toContain('> **Bob:** Add caching layer');
  });

  it('skips detail section for nodes without extra data', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'plain', type: 'compute/service' })],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).not.toContain('### plain');
  });

  it('skips detail section for ref nodes', () => {
    const canvas = makeCanvas({
      nodes: [makeRefNode({ id: 'ref-svc', ref: 'some-service' })],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).not.toContain('### ref-svc');
  });

  // ────────────────────────────────────────────
  // Edges section
  // ────────────────────────────────────────────

  it('renders an empty edges message for canvas with no edges', () => {
    const canvas = makeCanvas({ edges: [] });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('_No edges defined._');
  });

  it('renders edges table', () => {
    const canvas = makeCanvas({
      edges: [
        makeEdge({ from: { node: 'svc-a' }, to: { node: 'svc-b' }, protocol: 'HTTP', label: 'API calls' }),
        makeEdge({ from: { node: 'svc-b' }, to: { node: 'db' } }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('| From | To | Protocol | Label |');
    expect(md).toContain('| svc-a | svc-b | HTTP | API calls |');
    expect(md).toContain('| svc-b | db |');
  });

  it('renders edge ports in endpoint format', () => {
    const canvas = makeCanvas({
      edges: [
        makeEdge({ from: { node: 'svc-a', port: 'http-out' }, to: { node: 'svc-b', port: 'http-in' } }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('| svc-a:http-out | svc-b:http-in |');
  });

  // ────────────────────────────────────────────
  // Entities section
  // ────────────────────────────────────────────

  it('renders entities table', () => {
    const canvas = makeCanvas({
      entities: [
        makeEntity({ name: 'Order', description: 'A purchase order' }),
        makeEntity({ name: 'User' }),
      ],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('## Entities');
    expect(md).toContain('| Order | A purchase order |');
    expect(md).toContain('| User |');
  });

  it('omits entities section when includeEntities is false', () => {
    const canvas = makeCanvas({
      entities: [makeEntity({ name: 'Order' })],
    });
    const md = exportCanvasToMarkdown(canvas, { includeEntities: false });
    expect(md).not.toContain('## Entities');
  });

  it('omits entities section when entities array is empty', () => {
    const canvas = makeCanvas({ entities: [] });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).not.toContain('## Entities');
  });

  // ────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────

  it('handles completely empty canvas', () => {
    const canvas = makeCanvas({});
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('# Untitled Canvas');
    expect(md).toContain('## Nodes');
    expect(md).toContain('_No nodes defined._');
    expect(md).toContain('## Edges');
    expect(md).toContain('_No edges defined._');
  });

  it('escapes pipe characters in table cells', () => {
    const canvas = makeCanvas({
      nodes: [makeNode({ id: 'svc', type: 'a|b', displayName: 'Service | Test' })],
    });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('Service \\| Test');
    expect(md).toContain('`a\\|b`');
  });

  it('handles canvas with undefined nodes/edges/entities', () => {
    const canvas = makeCanvas({ nodes: undefined, edges: undefined, entities: undefined });
    const md = exportCanvasToMarkdown(canvas);
    expect(md).toContain('_No nodes defined._');
    expect(md).toContain('_No edges defined._');
    // Should not crash
    expect(typeof md).toBe('string');
  });

  // ────────────────────────────────────────────
  // Full integration snapshot
  // ────────────────────────────────────────────

  it('produces complete Markdown for a full canvas', () => {
    const canvas = makeCanvas({
      displayName: 'Payment System',
      description: 'Handles all payment processing.',
      nodes: [
        makeNode({ id: 'api', type: 'compute/service', displayName: 'API Gateway', description: 'Entry point' }),
        makeNode({ id: 'db', type: 'storage/database', displayName: 'PostgreSQL', args: { engine: 'postgres' } }),
        makeRefNode({ id: 'auth', ref: 'auth-service' }),
      ],
      edges: [
        makeEdge({ from: { node: 'api' }, to: { node: 'db' }, protocol: 'SQL', label: 'queries' }),
        makeEdge({ from: { node: 'api' }, to: { node: 'auth' }, protocol: 'gRPC' }),
      ],
      entities: [
        makeEntity({ name: 'Payment', description: 'A payment transaction' }),
      ],
    });

    const md = exportCanvasToMarkdown(canvas);

    // Check all major sections
    expect(md).toContain('# Payment System');
    expect(md).toContain('Handles all payment processing.');
    expect(md).toContain('## Table of Contents');
    expect(md).toContain('## Nodes');
    expect(md).toContain('API Gateway');
    expect(md).toContain('PostgreSQL');
    expect(md).toContain('auth (subsystem)');
    expect(md).toContain('## Edges');
    expect(md).toContain('api | db | SQL | queries');
    expect(md).toContain('## Entities');
    expect(md).toContain('Payment');
    expect(md).toContain('### PostgreSQL');
    expect(md).toContain('- **engine:** postgres');
  });
});
