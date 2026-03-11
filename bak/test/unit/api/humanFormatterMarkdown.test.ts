/**
 * Feature #55: Human formatter produces valid Markdown with emoji badges
 * Verifies the Human formatter produces readable Markdown with emoji badges for node types.
 *
 * Steps:
 * 1. Create architecture with 2 nodes (service and database) and 1 edge
 * 2. Call describe with format='human'
 * 3. Verify output is valid Markdown
 * 4. Verify output contains emoji badges for node types
 * 5. Verify output contains node display names
 * 6. Verify output contains edge descriptions
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi, getNodeTypeEmoji } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import { createEmptyGraph } from '@/core/graph/graphEngine';

describe('Feature #55: Human formatter produces valid Markdown with emoji badges', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  // Step 1: Create architecture with 2 nodes (service and database) and 1 edge
  function createTestArchitecture() {
    const graph = createEmptyGraph('E-Commerce Platform');
    const textApi = new TextApi(graph, registry);

    const service = textApi.addNode({
      type: 'compute/service',
      displayName: 'Order Service',
      position: { x: 100, y: 100 },
      args: { language: 'TypeScript' },
    });

    const database = textApi.addNode({
      type: 'data/database',
      displayName: 'Orders DB',
      position: { x: 300, y: 100 },
      args: { engine: 'PostgreSQL' },
    });

    textApi.addEdge({
      fromNode: service.id,
      toNode: database.id,
      type: 'sync',
      label: 'reads/writes',
    });

    return { textApi, service, database };
  }

  // Step 2: Call describe with format='human'
  it('should produce output when called with format=human', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });
    expect(output).toBeDefined();
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  // Step 3: Verify output is valid Markdown
  it('should produce valid Markdown with proper headings', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    // Has h1 heading for architecture name
    expect(output).toContain('# E-Commerce Platform');
    // Has h2 sections
    expect(output).toContain('## Summary');
    expect(output).toContain('## Nodes');
    expect(output).toContain('## Edges');
  });

  it('should contain summary statistics', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    expect(output).toContain('- Nodes: 2');
    expect(output).toContain('- Edges: 1');
  });

  // Step 4: Verify output contains emoji badges for node types
  it('should contain emoji badge for service node type', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    // compute/service should have ⚙️ emoji
    expect(output).toContain('⚙️');
  });

  it('should contain emoji badge for database node type', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    // data/database should have 🗄️ emoji
    expect(output).toContain('🗄️');
  });

  it('should have emoji badge immediately before bold display name', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    // Pattern: - {emoji} **{displayName}** ({type})
    expect(output).toMatch(/⚙️ \*\*Order Service\*\*/);
    expect(output).toMatch(/🗄️ \*\*Orders DB\*\*/);
  });

  // Step 5: Verify output contains node display names
  it('should contain node display names in bold', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    expect(output).toContain('**Order Service**');
    expect(output).toContain('**Orders DB**');
  });

  it('should contain node type identifiers', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    expect(output).toContain('(compute/service)');
    expect(output).toContain('(data/database)');
  });

  // Step 6: Verify output contains edge descriptions
  it('should contain edge description with node names and type', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    // Edge should reference node display names, not IDs
    expect(output).toContain('Order Service');
    expect(output).toContain('Orders DB');
    expect(output).toContain('[sync]');
    expect(output).toContain('"reads/writes"');
  });

  it('should contain edge arrow notation', () => {
    const { textApi } = createTestArchitecture();
    const output = textApi.describe({ scope: 'full', format: 'human' });

    // Should have arrow between node names
    expect(output).toContain('→');
    expect(output).toMatch(/Order Service → Orders DB/);
  });

  // Additional tests for emoji badge mapping
  it('getNodeTypeEmoji returns correct emoji for compute/service', () => {
    expect(getNodeTypeEmoji('compute/service')).toBe('⚙️');
  });

  it('getNodeTypeEmoji returns correct emoji for data/database', () => {
    expect(getNodeTypeEmoji('data/database')).toBe('🗄️');
  });

  it('getNodeTypeEmoji returns correct emoji for messaging/message-queue', () => {
    expect(getNodeTypeEmoji('messaging/message-queue')).toBe('📨');
  });

  it('getNodeTypeEmoji returns correct emoji for network/load-balancer', () => {
    expect(getNodeTypeEmoji('network/load-balancer')).toBe('⚖️');
  });

  it('getNodeTypeEmoji returns correct emoji for observability/logging', () => {
    expect(getNodeTypeEmoji('observability/logging')).toBe('📋');
  });

  it('getNodeTypeEmoji falls back to namespace emoji for unknown type', () => {
    expect(getNodeTypeEmoji('compute/unknown')).toBe('⚙️');
    expect(getNodeTypeEmoji('data/unknown')).toBe('🗄️');
    expect(getNodeTypeEmoji('messaging/unknown')).toBe('📨');
  });

  it('getNodeTypeEmoji falls back to generic emoji for completely unknown type', () => {
    expect(getNodeTypeEmoji('unknown/type')).toBe('📦');
    expect(getNodeTypeEmoji('custom')).toBe('📦');
  });

  it('should produce different emoji badges for different node types', () => {
    const graph = createEmptyGraph('Multi Type');
    const textApi = new TextApi(graph, registry);

    textApi.addNode({ type: 'compute/service', displayName: 'Service A' });
    textApi.addNode({ type: 'data/database', displayName: 'DB A' });
    textApi.addNode({ type: 'messaging/message-queue', displayName: 'Queue A' });

    const output = textApi.describe({ scope: 'full', format: 'human' });

    expect(output).toContain('⚙️ **Service A**');
    expect(output).toContain('🗄️ **DB A**');
    expect(output).toContain('📨 **Queue A**');
  });

  it('should handle architecture with no edges gracefully', () => {
    const graph = createEmptyGraph('No Edges');
    const textApi = new TextApi(graph, registry);

    textApi.addNode({ type: 'compute/service', displayName: 'Lonely Service' });

    const output = textApi.describe({ scope: 'full', format: 'human' });

    expect(output).toContain('# No Edges');
    expect(output).toContain('## Summary');
    expect(output).toContain('- Nodes: 1');
    expect(output).toContain('- Edges: 0');
    expect(output).toContain('⚙️ **Lonely Service**');
    expect(output).not.toContain('## Edges');
  });

  it('should handle empty architecture gracefully', () => {
    const graph = createEmptyGraph('Empty');
    const textApi = new TextApi(graph, registry);

    const output = textApi.describe({ scope: 'full', format: 'human' });

    expect(output).toContain('# Empty');
    expect(output).toContain('- Nodes: 0');
    expect(output).not.toContain('## Nodes');
    expect(output).not.toContain('## Edges');
  });
});
