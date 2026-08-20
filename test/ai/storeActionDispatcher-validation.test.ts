import { describe, it, expect, beforeEach } from 'vitest';
import { enablePatches } from 'immer';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useValidationStore } from '@/store/validationStore';
import { InMemoryFileSystem } from '@/platform/inMemoryFileSystem';
import { serializeCanvas } from '@/storage/yamlCodec';
import { dispatchStoreAction } from '@/core/ai/storeActionDispatcher';
import { ROOT_CANVAS_KEY } from '@/storage/fileResolver';

enablePatches();

async function setup() {
  useFileStore.setState({
    project: null, dirtyCanvases: new Set(), status: 'idle', error: null,
  });
  useValidationStore.setState({ report: null, status: 'idle' });
  const fs = new InMemoryFileSystem();
  fs.seed({
    '.archcanvas/main.yaml': serializeCanvas({
      project: { name: 'Test' },
      nodes: [
        { id: 'db-a', type: 'data/database', args: { engine: 'PostgreSQL', replicas: 0 } },
      ],
      edges: [],
    } as any),
  });
  await useFileStore.getState().openProject(fs);
  await useRegistryStore.getState().initialize();
}

describe('dispatchStoreAction — validateArchitecture', () => {
  beforeEach(setup);

  it('returns a ValidationReport for a known canvas and updates validationStore', async () => {
    const result = await dispatchStoreAction('validateArchitecture', { canvasId: ROOT_CANVAS_KEY });
    expect(result).toMatchObject({
      canvasId: ROOT_CANVAS_KEY,
      findings: expect.any(Array),
      summary: expect.any(Object),
    });
    // The lone unbacked-up database should trip db-no-backup.
    expect((result as any).findings.some((f: any) => f.ruleId === 'db-no-backup')).toBe(true);
    expect(useValidationStore.getState().report).toEqual(result);
    expect(useValidationStore.getState().status).toBe('done');
  });

  it('defaults canvasId to __root__ when omitted', async () => {
    const result = await dispatchStoreAction('validateArchitecture', {});
    expect((result as any).canvasId).toBe(ROOT_CANVAS_KEY);
  });

  it('returns a structured error (does not throw) for an unknown canvas', async () => {
    const result = await dispatchStoreAction('validateArchitecture', { canvasId: 'does-not-exist' });
    expect(result).toMatchObject({ ok: false, error: { code: 'CANVAS_NOT_FOUND' } });
  });
});
