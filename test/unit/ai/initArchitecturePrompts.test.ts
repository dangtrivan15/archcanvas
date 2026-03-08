/**
 * Tests for the agentic architecture building prompts.
 *
 * Verifies that the system prompt and user prompt builder produce valid,
 * complete prompts containing all required elements (tools, node types,
 * edge types, iterative instructions).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildDynamicNodeTypes,
  formatNodeTypes,
  type ProjectMetadata,
  type KeyFileContent,
} from '@/ai/prompts/initArchitecture';
import { RegistryManagerCore } from '@/core/registry/registryCore';
import type { NodeDef } from '@/types/nodedef';

// ── Mock Registry ────────────────────────────────────────────────────────────

function createMockNodeDef(
  namespace: string,
  name: string,
  displayName: string,
  description: string,
  aiContext?: string,
): NodeDef {
  return {
    kind: 'NodeDef',
    apiVersion: 'v1',
    metadata: {
      name,
      namespace,
      version: '1.0.0',
      displayName,
      description,
      icon: 'box',
      tags: [],
    },
    spec: {
      args: [],
      ports: [
        { name: 'inbound', direction: 'inbound' as const, protocol: ['any'] },
        { name: 'outbound', direction: 'outbound' as const, protocol: ['any'] },
      ],
      ai: aiContext ? { context: aiContext } : undefined,
    },
  };
}

function createMockRegistry(): RegistryManagerCore {
  const registry = new RegistryManagerCore();
  registry.initialize([
    createMockNodeDef('compute', 'service', 'Service', 'A backend service or microservice'),
    createMockNodeDef(
      'compute',
      'function',
      'Function',
      'A serverless function',
      'Use for AWS Lambda, Azure Functions, etc.',
    ),
    createMockNodeDef('data', 'database', 'Database', 'A relational or NoSQL database'),
    createMockNodeDef('messaging', 'message-queue', 'Message Queue', 'A message queue'),
  ]);
  return registry;
}

// ── Sample Metadata ──────────────────────────────────────────────────────────

function createSampleMetadata(overrides?: Partial<ProjectMetadata>): ProjectMetadata {
  return {
    name: 'my-app',
    directoryListing: `src/
  main.ts
  server.ts
  routes/
    users.ts
    orders.ts
package.json
tsconfig.json
Dockerfile`,
    keyFiles: [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: 'my-app',
            dependencies: {
              express: '^4.18.0',
              pg: '^8.11.0',
              redis: '^4.6.0',
            },
          },
          null,
          2,
        ),
      },
    ],
    languages: [
      { name: 'TypeScript', percentage: 85 },
      { name: 'JavaScript', percentage: 15 },
    ],
    frameworks: ['Express.js', 'React'],
    infraSignals: ['Docker', 'GitHub Actions CI'],
    ...overrides,
  };
}

// ── System Prompt Tests ──────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('includes the architect role description', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('expert software architect');
    expect(prompt).toContain('ArchCanvas');
  });

  it('includes all MCP mutation tool descriptions', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('add_node');
    expect(prompt).toContain('add_edge');
    expect(prompt).toContain('add_code_ref');
    expect(prompt).toContain('add_note');
    expect(prompt).toContain('update_node');
    expect(prompt).toContain('remove_node');
    expect(prompt).toContain('remove_edge');
    expect(prompt).toContain('init_architecture');
  });

  it('includes query tool descriptions', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('describe');
    expect(prompt).toContain('list_nodedefs');
    expect(prompt).toContain('search');
    expect(prompt).toContain('get_edges');
  });

  it('includes edge type guidance with all three types', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('sync');
    expect(prompt).toContain('async');
    expect(prompt).toContain('data-flow');
    // Check for guidance text
    expect(prompt).toContain('Synchronous request-response');
    expect(prompt).toContain('Asynchronous');
    expect(prompt).toContain('Data movement');
  });

  it('includes code reference role guidance', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('source');
    expect(prompt).toContain('api-spec');
    expect(prompt).toContain('schema');
    expect(prompt).toContain('deployment');
    expect(prompt).toContain('config');
    expect(prompt).toContain('test');
  });

  it('includes iterative workflow steps', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Step 1');
    expect(prompt).toContain('Step 2');
    expect(prompt).toContain('Step 3');
    expect(prompt).toContain('Step 4');
    expect(prompt).toContain('Step 5');
    expect(prompt).toContain('Step 6');
    expect(prompt).toContain('Scan');
    expect(prompt).toContain('Plan');
    expect(prompt).toContain('Create Nodes');
    expect(prompt).toContain('Establish Edges');
    expect(prompt).toContain('Attach Code References');
    expect(prompt).toContain('Review');
  });

  it('includes static node types when no registry provided', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('compute/service');
    expect(prompt).toContain('data/database');
    expect(prompt).toContain('messaging/message-queue');
    expect(prompt).toContain('network/load-balancer');
    expect(prompt).toContain('observability/logging');
  });

  it('includes dynamic node types when registry is provided', () => {
    const registry = createMockRegistry();
    const prompt = buildSystemPrompt(registry);
    expect(prompt).toContain('compute/service');
    expect(prompt).toContain('compute/function');
    expect(prompt).toContain('data/database');
    expect(prompt).toContain('messaging/message-queue');
  });

  it('includes AI context hints from registry nodedefs', () => {
    const registry = createMockRegistry();
    const prompt = buildSystemPrompt(registry);
    expect(prompt).toContain('Use for AWS Lambda, Azure Functions, etc.');
  });

  it('includes guidelines about connected graphs', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('connected');
    expect(prompt).toContain('No orphan nodes');
    expect(prompt).toContain('Label edges');
  });

  it('includes add_node parameter documentation', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('type (string');
    expect(prompt).toContain('displayName (string');
    expect(prompt).toContain('parentId');
  });

  it('includes add_edge parameter documentation', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('fromNode');
    expect(prompt).toContain('toNode');
    expect(prompt).toContain('"sync" | "async" | "data-flow"');
  });
});

// ── User Prompt Tests ────────────────────────────────────────────────────────

describe('buildUserPrompt', () => {
  it('includes the project name', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('my-app');
  });

  it('includes the directory listing', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('src/');
    expect(prompt).toContain('main.ts');
    expect(prompt).toContain('server.ts');
    expect(prompt).toContain('package.json');
  });

  it('includes key file contents', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('"express"');
    expect(prompt).toContain('"pg"');
    expect(prompt).toContain('"redis"');
  });

  it('includes language information when provided', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('TypeScript: 85%');
    expect(prompt).toContain('JavaScript: 15%');
  });

  it('includes framework information when provided', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('Express.js');
    expect(prompt).toContain('React');
  });

  it('includes infrastructure signals when provided', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('Docker');
    expect(prompt).toContain('GitHub Actions CI');
  });

  it('includes project description when provided', () => {
    const prompt = buildUserPrompt(
      createSampleMetadata({ description: 'An e-commerce platform backend' }),
    );
    expect(prompt).toContain('An e-commerce platform backend');
  });

  it('omits optional sections when not provided', () => {
    const prompt = buildUserPrompt(
      createSampleMetadata({
        languages: undefined,
        frameworks: undefined,
        infraSignals: undefined,
        description: undefined,
      }),
    );
    expect(prompt).not.toContain('Detected Languages');
    expect(prompt).not.toContain('Detected Frameworks');
    expect(prompt).not.toContain('Infrastructure Signals');
    expect(prompt).not.toContain('Project Description');
  });

  it('includes init_architecture instruction with project name', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('init_architecture');
    expect(prompt).toContain('my-app');
  });

  it('includes instructions to create a connected graph', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('connected graph');
    expect(prompt).toContain('add_node');
    expect(prompt).toContain('add_edge');
    expect(prompt).toContain('add_code_ref');
  });

  it('handles empty key files array', () => {
    const prompt = buildUserPrompt(createSampleMetadata({ keyFiles: [] }));
    expect(prompt).not.toContain('Key File Contents');
    // Should still have directory listing
    expect(prompt).toContain('Directory Structure');
  });

  it('handles multiple key files', () => {
    const keyFiles: KeyFileContent[] = [
      { path: 'package.json', content: '{"name": "test"}' },
      { path: 'tsconfig.json', content: '{"compilerOptions": {}}' },
      { path: 'Dockerfile', content: 'FROM node:20' },
    ];
    const prompt = buildUserPrompt(createSampleMetadata({ keyFiles }));
    expect(prompt).toContain('### package.json');
    expect(prompt).toContain('### tsconfig.json');
    expect(prompt).toContain('### Dockerfile');
    expect(prompt).toContain('FROM node:20');
  });

  it('wraps directory listing in a code block', () => {
    const prompt = buildUserPrompt(createSampleMetadata());
    expect(prompt).toContain('```\n' + createSampleMetadata().directoryListing + '\n```');
  });
});

// ── Dynamic Node Types Tests ─────────────────────────────────────────────────

describe('buildDynamicNodeTypes', () => {
  it('lists all namespaces from the registry', () => {
    const registry = createMockRegistry();
    const text = buildDynamicNodeTypes(registry);
    expect(text).toContain('### Compute');
    expect(text).toContain('### Data');
    expect(text).toContain('### Messaging');
  });

  it('includes all node types with namespace/name format', () => {
    const registry = createMockRegistry();
    const text = buildDynamicNodeTypes(registry);
    expect(text).toContain('compute/service');
    expect(text).toContain('compute/function');
    expect(text).toContain('data/database');
    expect(text).toContain('messaging/message-queue');
  });

  it('includes node descriptions', () => {
    const registry = createMockRegistry();
    const text = buildDynamicNodeTypes(registry);
    expect(text).toContain('A backend service or microservice');
    expect(text).toContain('A relational or NoSQL database');
  });

  it('includes AI context hints when available', () => {
    const registry = createMockRegistry();
    const text = buildDynamicNodeTypes(registry);
    expect(text).toContain('Use for AWS Lambda, Azure Functions, etc.');
  });

  it('falls back to static text when registry is empty', () => {
    const registry = new RegistryManagerCore();
    registry.initialize([]);
    const text = buildDynamicNodeTypes(registry);
    // Should fall back to static NODE_TYPE_REGISTRY_TEXT
    expect(text).toContain('Available ArchCanvas Node Types');
    expect(text).toContain('compute/service');
  });

  it('sorts namespaces alphabetically', () => {
    const registry = createMockRegistry();
    const text = buildDynamicNodeTypes(registry);
    const computeIdx = text.indexOf('### Compute');
    const dataIdx = text.indexOf('### Data');
    const messagingIdx = text.indexOf('### Messaging');
    expect(computeIdx).toBeLessThan(dataIdx);
    expect(dataIdx).toBeLessThan(messagingIdx);
  });
});

// ── formatNodeTypes Tests ────────────────────────────────────────────────────

describe('formatNodeTypes', () => {
  it('formats an array of NodeDefs into a readable list', () => {
    const defs = [
      createMockNodeDef('compute', 'service', 'Service', 'A backend service'),
      createMockNodeDef('data', 'database', 'Database', 'A database'),
    ];
    const result = formatNodeTypes(defs);
    expect(result).toBe(
      '- compute/service: A backend service\n- data/database: A database',
    );
  });

  it('returns empty string for empty array', () => {
    expect(formatNodeTypes([])).toBe('');
  });
});

// ── Integration: System + User Prompt Together ───────────────────────────────

describe('prompt integration', () => {
  it('system + user prompt form a complete instruction set', () => {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(createSampleMetadata());

    // System prompt has the tools and methodology
    expect(systemPrompt).toContain('add_node');
    expect(systemPrompt).toContain('add_edge');
    expect(systemPrompt).toContain('add_code_ref');
    expect(systemPrompt).toContain('Step 1');

    // User prompt has the project context
    expect(userPrompt).toContain('my-app');
    expect(userPrompt).toContain('package.json');
    expect(userPrompt).toContain('TypeScript');

    // Both are non-empty strings
    expect(systemPrompt.length).toBeGreaterThan(500);
    expect(userPrompt.length).toBeGreaterThan(100);
  });

  it('user prompt includes all available node types from a mock registry', () => {
    const registry = createMockRegistry();
    const systemPrompt = buildSystemPrompt(registry);

    // All 4 mock types should be present
    const types = ['compute/service', 'compute/function', 'data/database', 'messaging/message-queue'];
    for (const t of types) {
      expect(systemPrompt).toContain(t);
    }
  });
});
