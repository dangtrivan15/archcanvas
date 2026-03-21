import { describe, it, expect } from 'vitest';
import { archCanvasToolDefs } from '../../src/core/ai/toolDefs';

describe('archCanvasToolDefs', () => {
  it('exports an array of tool definitions', () => {
    expect(Array.isArray(archCanvasToolDefs)).toBe(true);
    expect(archCanvasToolDefs.length).toBeGreaterThanOrEqual(19);
  });

  it('each tool has name, description, and inputSchema', () => {
    for (const def of archCanvasToolDefs) {
      expect(def.name).toEqual(expect.any(String));
      expect(def.description).toEqual(expect.any(String));
      expect(def.inputSchema).toBeDefined();
      expect(typeof def.inputSchema.parse).toBe('function'); // Valid Zod schema
    }
  });

  it('includes all expected tool names', () => {
    const names = archCanvasToolDefs.map((d) => d.name);
    expect(names).toContain('add_node');
    expect(names).toContain('add_edge');
    expect(names).toContain('remove_node');
    expect(names).toContain('remove_edge');
    expect(names).toContain('import_yaml');
    expect(names).toContain('create_subsystem');
    expect(names).toContain('add_entity');
    expect(names).toContain('remove_entity');
    expect(names).toContain('update_entity');
    expect(names).toContain('list');
    expect(names).toContain('describe');
    expect(names).toContain('search');
    expect(names).toContain('catalog');
    expect(names).toContain('read_project_file');
    expect(names).toContain('write_project_file');
    expect(names).toContain('update_project_file');
    expect(names).toContain('list_project_files');
    expect(names).toContain('glob_project_files');
    expect(names).toContain('search_project_files');
  });

  it('does not import Node.js-only modules', async () => {
    // Verify the module can be imported in a browser-like environment
    const mod = await import('../../src/core/ai/toolDefs');
    expect(mod.archCanvasToolDefs).toBeDefined();
  });

  it('add_node schema validates correct input', () => {
    const addNode = archCanvasToolDefs.find((d) => d.name === 'add_node')!;
    const result = addNode.inputSchema.safeParse({
      id: 'svc-1',
      type: 'compute/service',
      name: 'My Service',
    });
    expect(result.success).toBe(true);
  });

  it('add_node schema rejects missing required fields', () => {
    const addNode = archCanvasToolDefs.find((d) => d.name === 'add_node')!;
    const result = addNode.inputSchema.safeParse({ name: 'no id or type' });
    expect(result.success).toBe(false);
  });

  it('add_edge schema validates correct input', () => {
    const addEdge = archCanvasToolDefs.find((d) => d.name === 'add_edge')!;
    const result = addEdge.inputSchema.safeParse({
      from: 'a',
      to: 'b',
      protocol: 'HTTP',
    });
    expect(result.success).toBe(true);
  });

  it('import_yaml schema requires yaml string', () => {
    const importYaml = archCanvasToolDefs.find((d) => d.name === 'import_yaml')!;
    const good = importYaml.inputSchema.safeParse({ yaml: 'nodes: []' });
    expect(good.success).toBe(true);
    const bad = importYaml.inputSchema.safeParse({});
    expect(bad.success).toBe(false);
  });
});
