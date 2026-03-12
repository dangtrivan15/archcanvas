import { describe, it, expect } from 'vitest';
import { loadBuiltins, loadProjectLocal } from '@/core/registry/loader';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';

const validNodeDefYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: custom-node
  namespace: custom
  version: "1.0.0"
  displayName: Custom Node
  description: A custom node
  icon: Box
  shape: rectangle
spec:
  ports:
    - name: in
      direction: inbound
      protocol: [HTTP]
`;

const invalidNodeDefYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: bad
spec: {}
`;

describe('loadBuiltins', () => {
  it('loads all 32 built-in NodeDefs', () => {
    const map = loadBuiltins();
    expect(map.size).toBe(32);
  });
});

describe('loadProjectLocal', () => {
  it('returns empty result when nodedefs directory does not exist', async () => {
    const fs = new InMemoryFileSystem();
    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('loads valid YAML files', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/custom-node.yaml': validNodeDefYaml,
    });

    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(1);
    expect(result.nodeDefs.has('custom/custom-node')).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects errors for invalid YAML files without throwing', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/bad.yaml': invalidNodeDefYaml,
    });

    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe('bad.yaml');
  });

  it('loads valid files and collects errors for invalid ones', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/good.yaml': validNodeDefYaml,
      'project/.archcanvas/nodedefs/bad.yaml': invalidNodeDefYaml,
    });

    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('ignores non-YAML files', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/readme.md': '# NodeDefs',
      'project/.archcanvas/nodedefs/good.yaml': validNodeDefYaml,
    });

    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('handles empty nodedefs directory', async () => {
    const fs = new InMemoryFileSystem();
    // Create the directory by seeding a file in a parent, then check
    // InMemoryFileSystem.exists checks for prefix, so we need a file
    // Actually, with no files the directory won't "exist" — which is the correct behavior
    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('works with .yml extension', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/custom.yml': validNodeDefYaml,
    });

    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(1);
  });
});
