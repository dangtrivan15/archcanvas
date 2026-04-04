import { describe, it, expect } from 'vitest';
import { exportMarkdown } from '@/export/exportMarkdown';
import type { Canvas } from '@/types';

describe('exportMarkdown', () => {
  it('exports a canvas with nodes, edges, and entities', () => {
    const canvas: Canvas = {
      project: { name: 'My Project' },
      description: 'A test architecture',
      nodes: [
        { id: 'api', type: 'core/service', displayName: 'API Gateway', description: 'Handles requests' },
        { id: 'db', type: 'core/database', displayName: 'Database' },
      ],
      edges: [
        { from: { node: 'api' }, to: { node: 'db' }, protocol: 'TCP', label: 'queries' },
      ],
      entities: [
        { name: 'User', description: 'A registered user' },
        { name: 'Order' },
      ],
    };

    const md = exportMarkdown(canvas);

    // Title comes from project name
    expect(md).toContain('# My Project');
    // Description
    expect(md).toContain('A test architecture');
    // Components section
    expect(md).toContain('## Components');
    expect(md).toContain('### API Gateway');
    expect(md).toContain('- **Type:** core/service');
    expect(md).toContain('- **ID:** `api`');
    expect(md).toContain('- **Description:** Handles requests');
    expect(md).toContain('### Database');
    // Entities section
    expect(md).toContain('## Entities');
    expect(md).toContain('- **User**: A registered user');
    expect(md).toContain('- **Order**');
    // Connections table
    expect(md).toContain('## Connections');
    expect(md).toContain('| api | db | TCP | queries |');
    // Mermaid diagram
    expect(md).toContain('```mermaid');
    expect(md).toContain('graph TD');
    expect(md).toContain('api["API Gateway"]');
    expect(md).toContain('db["Database"]');
    expect(md).toContain('api -->|"queries"| db');
    expect(md).toContain('```');
  });

  it('uses displayName for title when no project name', () => {
    const canvas: Canvas = {
      displayName: 'Auth Subsystem',
      nodes: [{ id: 'svc', type: 'core/service' }],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('# Auth Subsystem');
  });

  it('falls back to "Architecture" when no name is available', () => {
    const canvas: Canvas = {
      nodes: [{ id: 'svc', type: 'core/service' }],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('# Architecture');
  });

  it('handles an empty canvas gracefully', () => {
    const canvas: Canvas = {};

    const md = exportMarkdown(canvas);
    expect(md).toContain('# Architecture');
    // No Components, Entities, Connections, or Diagram sections
    expect(md).not.toContain('## Components');
    expect(md).not.toContain('## Entities');
    expect(md).not.toContain('## Connections');
    expect(md).not.toContain('## Diagram');
  });

  it('handles ref nodes', () => {
    const canvas: Canvas = {
      nodes: [{ id: 'auth', ref: 'auth-subsystem' }],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('### auth');
    expect(md).toContain('- **Type:** ref');
    expect(md).toContain('- **Ref:** `auth-subsystem`');
  });

  it('includes node args in output', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'svc', type: 'core/service', args: { port: '8080', replicas: '3' } },
      ],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('- **Properties:**');
    expect(md).toContain('  - port: `8080`');
    expect(md).toContain('  - replicas: `3`');
  });

  it('includes codeRefs in output', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'svc', type: 'core/service', codeRefs: ['src/main.ts', 'src/api.ts'] },
      ],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('- **Code refs:** `src/main.ts`, `src/api.ts`');
  });

  it('renders edge with port info', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'core/service' },
        { id: 'b', type: 'core/service' },
      ],
      edges: [
        { from: { node: 'a', port: 'out' }, to: { node: 'b', port: 'in' } },
      ],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('| a:out | b:in |');
  });

  it('renders edges with entities in the table', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'core/service' },
        { id: 'b', type: 'core/service' },
      ],
      edges: [
        { from: { node: 'a' }, to: { node: 'b' }, entities: ['User', 'Order'] },
      ],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('User, Order');
  });

  it('uses protocol as mermaid edge label when no label is set', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'core/service' },
        { id: 'b', type: 'core/service' },
      ],
      edges: [
        { from: { node: 'a' }, to: { node: 'b' }, protocol: 'gRPC' },
      ],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('a -->|"gRPC"| b');
  });

  it('renders unlabeled edges without annotation in mermaid', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'a', type: 'core/service' },
        { id: 'b', type: 'core/service' },
      ],
      edges: [
        { from: { node: 'a' }, to: { node: 'b' } },
      ],
    };

    const md = exportMarkdown(canvas);
    expect(md).toContain('a --> b');
  });

  it('sanitizes special characters in Mermaid IDs', () => {
    const canvas: Canvas = {
      nodes: [
        { id: 'my.service/v2', type: 'core/service', displayName: 'My Service' },
      ],
    };

    const md = exportMarkdown(canvas);
    // Dots and slashes should be replaced with underscores
    expect(md).toContain('my_service_v2["My Service"]');
  });
});
