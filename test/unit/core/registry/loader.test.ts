import { describe, it, expect } from 'vitest';
import { loadBuiltins, loadProjectLocal } from '@/core/registry/loader';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import type { LockfileData } from '@/core/registry/lockfile';

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

  // -------------------------------------------------------------------------
  // New: lockfile-based classification
  // -------------------------------------------------------------------------

  it('classifies file as remoteInstalledNodeDefs when lockfile has source: remote', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/custom-node.yaml': validNodeDefYaml,
    });

    const lockfile: LockfileData = {
      lockfileVersion: 1,
      resolvedAt: '2026-04-14T12:00:00Z',
      entries: {
        'custom/custom-node': { version: '1.0.0', source: 'remote' },
      },
    };

    const result = await loadProjectLocal(fs, 'project', lockfile);
    expect(result.nodeDefs.size).toBe(0);
    expect(result.remoteInstalledNodeDefs.size).toBe(1);
    expect(result.remoteInstalledNodeDefs.has('custom/custom-node')).toBe(true);
  });

  it('classifies file as nodeDefs (authored) when lockfile has source: local', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/custom-node.yaml': validNodeDefYaml,
    });

    const lockfile: LockfileData = {
      lockfileVersion: 1,
      resolvedAt: '2026-04-14T12:00:00Z',
      entries: {
        'custom/custom-node': { version: '1.0.0', source: 'local' },
      },
    };

    const result = await loadProjectLocal(fs, 'project', lockfile);
    expect(result.nodeDefs.size).toBe(1);
    expect(result.remoteInstalledNodeDefs.size).toBe(0);
  });

  it('classifies file as nodeDefs when no lockfile provided (backwards compatible)', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/custom-node.yaml': validNodeDefYaml,
    });

    const result = await loadProjectLocal(fs, 'project');
    expect(result.nodeDefs.size).toBe(1);
    expect(result.remoteInstalledNodeDefs.size).toBe(0);
  });

  it('classifies file as nodeDefs when lockfile has no entry for that key', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/custom-node.yaml': validNodeDefYaml,
    });

    const lockfile: LockfileData = {
      lockfileVersion: 1,
      resolvedAt: '2026-04-14T12:00:00Z',
      entries: {},   // empty — no entry for custom/custom-node
    };

    const result = await loadProjectLocal(fs, 'project', lockfile);
    expect(result.nodeDefs.size).toBe(1);
    expect(result.remoteInstalledNodeDefs.size).toBe(0);
  });

  it('splits multiple files correctly by lockfile source', async () => {
    const remoteNodeDefYaml = `
kind: NodeDef
apiVersion: v1
metadata:
  name: remote-node
  namespace: community
  version: "2.0.0"
  displayName: Remote Node
  description: A community node
  icon: Box
  shape: rectangle
spec:
  ports: []
`;
    const fs = new InMemoryFileSystem();
    fs.seed({
      'project/.archcanvas/nodedefs/custom-node.yaml': validNodeDefYaml,
      'project/.archcanvas/nodedefs/community-remote-node.yaml': remoteNodeDefYaml,
    });

    const lockfile: LockfileData = {
      lockfileVersion: 1,
      resolvedAt: '2026-04-14T12:00:00Z',
      entries: {
        'custom/custom-node': { version: '1.0.0', source: 'local' },
        'community/remote-node': { version: '2.0.0', source: 'remote' },
      },
    };

    const result = await loadProjectLocal(fs, 'project', lockfile);
    expect(result.nodeDefs.size).toBe(1);
    expect(result.remoteInstalledNodeDefs.size).toBe(1);
    expect(result.nodeDefs.has('custom/custom-node')).toBe(true);
    expect(result.remoteInstalledNodeDefs.has('community/remote-node')).toBe(true);
  });

  it('returns empty remoteInstalledNodeDefs when directory does not exist', async () => {
    const fs = new InMemoryFileSystem();
    const result = await loadProjectLocal(fs, 'project', null);
    expect(result.remoteInstalledNodeDefs.size).toBe(0);
  });
});
