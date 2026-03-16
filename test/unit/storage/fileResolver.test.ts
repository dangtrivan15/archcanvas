import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { loadProject, saveCanvas, ROOT_CANVAS_KEY } from '@/storage/fileResolver';
import { serializeCanvas } from '@/storage/yamlCodec';

function yamlOf(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serializeCanvas(data as any);
}

describe('loadProject', () => {
  let fs: InMemoryFileSystem;

  beforeEach(() => {
    fs = new InMemoryFileSystem();
  });

  it('loads a simple project with no refs', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'svc-api', type: 'compute/service' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.root.data.project?.name).toBe('Test');
    expect(project.root.data.nodes).toHaveLength(1);
    expect(project.canvases.has(ROOT_CANVAS_KEY)).toBe(true);
    expect(project.errors).toHaveLength(0);
  });

  it('resolves ref nodes to subsystem files', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'svc-api', ref: 'svc-api.yaml' },
          { id: 'db', type: 'data/database' },
        ],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        displayName: 'API Service',
        nodes: [{ id: 'handler', type: 'compute/function' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.canvases.has('svc-api')).toBe(true);
    expect(project.canvases.get('svc-api')?.data.displayName).toBe('API Service');
    expect(project.errors).toHaveLength(0);
  });

  it('resolves nested refs recursively', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'svc-api', ref: 'svc-api.yaml' }],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        id: 'svc-api',
        type: 'compute/service',
        nodes: [{ id: 'internal', ref: 'internal.yaml' }],
      }),
      '.archcanvas/internal.yaml': yamlOf({
        id: 'internal',
        type: 'compute/function',
        nodes: [{ id: 'leaf', type: 'compute/function' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.canvases.has('svc-api')).toBe(true);
    expect(project.canvases.has('internal')).toBe(true);
  });

  it('collects error for missing ref file', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'missing', ref: 'missing-service.yaml' }],
      }),
    });

    const project = await loadProject(fs);
    expect(project.errors).toHaveLength(1);
    expect(project.errors[0].message).toContain('missing-service');
  });

  it('detects circular refs and collects error', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'a', ref: 'a.yaml' }],
      }),
      '.archcanvas/a.yaml': yamlOf({
        id: 'a',
        type: 'compute/service',
        nodes: [{ id: 'b', ref: 'b.yaml' }],
      }),
      '.archcanvas/b.yaml': yamlOf({
        id: 'b',
        type: 'compute/service',
        nodes: [{ id: 'a-again', ref: 'a.yaml' }],
      }),
    });

    const project = await loadProject(fs);
    const circularError = project.errors.find((e) =>
      e.message.toLowerCase().includes('circular'),
    );
    expect(circularError).toBeDefined();
  });

  it('handles diamond dependencies without false circular error', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'a', ref: 'a.yaml' },
          { id: 'b', ref: 'b.yaml' },
        ],
      }),
      '.archcanvas/a.yaml': yamlOf({
        id: 'a',
        type: 'compute/service',
        nodes: [{ id: 'shared', ref: 'shared.yaml' }],
      }),
      '.archcanvas/b.yaml': yamlOf({
        id: 'b',
        type: 'compute/service',
        nodes: [{ id: 'shared-again', ref: 'shared.yaml' }],
      }),
      '.archcanvas/shared.yaml': yamlOf({
        id: 'shared',
        type: 'data/database',
      }),
    });

    const project = await loadProject(fs);
    expect(project.canvases.has('shared')).toBe(true);
    const circularErrors = project.errors.filter((e) =>
      e.message.toLowerCase().includes('circular'),
    );
    expect(circularErrors).toHaveLength(0);
  });

  it('loads canvas from ref with .yaml suffix without double extension', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [{ id: 'svc-api', ref: 'svc-api.yaml' }],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        type: 'compute/service',
        displayName: 'API Service',
        nodes: [],
        edges: [],
      }),
    });
    const project = await loadProject(fs);
    expect(project.errors).toHaveLength(0);
    expect(project.canvases.has('svc-api')).toBe(true);
  });

  it('validates @<ref-node-id>/<node-id> edges at load time', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'svc-api', ref: 'svc-api.yaml' },
          { id: 'db', type: 'data/database' },
        ],
        edges: [
          { from: { node: '@svc-api/handler' }, to: { node: 'db' } },
        ],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        type: 'compute/service',
        nodes: [{ id: 'handler', type: 'compute/function' }],
        edges: [],
      }),
    });
    const project = await loadProject(fs);
    expect(project.errors).toHaveLength(0);
  });

  it('reports error for invalid node in cross-scope ref', async () => {
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
        nodes: [
          { id: 'svc-api', ref: 'svc-api.yaml' },
          { id: 'db', type: 'data/database' },
        ],
        edges: [
          { from: { node: '@svc-api/nonexistent' }, to: { node: 'db' } },
        ],
      }),
      '.archcanvas/svc-api.yaml': yamlOf({
        type: 'compute/service',
        nodes: [{ id: 'handler', type: 'compute/function' }],
        edges: [],
      }),
    });
    const project = await loadProject(fs);
    expect(project.errors.length).toBeGreaterThan(0);
    expect(project.errors[0].message).toContain('nonexistent');
  });
});

describe('saveCanvas', () => {
  it('writes canvas back to the file system', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed({
      '.archcanvas/main.yaml': yamlOf({
        project: { name: 'Test' },
      }),
    });

    const project = await loadProject(fs);
    // Mutate data
    project.root.data.project!.name = 'Updated';

    await saveCanvas(fs, project.root);

    const written = await fs.readFile('.archcanvas/main.yaml');
    expect(written).toContain('Updated');
  });
});
