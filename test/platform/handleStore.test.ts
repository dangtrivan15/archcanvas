import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { storeHandle, getHandle, removeHandle } from '@/platform/handleStore';

// fake-indexeddb supports structured clone but not real FileSystemDirectoryHandle.
// Use plain objects as proxy — IndexedDB stores/retrieves any cloneable value.
const fakeHandle = { name: 'my-project', kind: 'directory' } as unknown as FileSystemDirectoryHandle;
const fakeHandle2 = { name: 'other-project', kind: 'directory' } as unknown as FileSystemDirectoryHandle;

beforeEach(() => {
  indexedDB.deleteDatabase('archcanvas');
});

describe('handleStore', () => {
  it('stores and retrieves a handle', async () => {
    await storeHandle('my-project', fakeHandle);
    const result = await getHandle('my-project');
    expect(result).toEqual(fakeHandle);
  });

  it('returns null for missing key', async () => {
    const result = await getHandle('nonexistent');
    expect(result).toBeNull();
  });

  it('removes a handle', async () => {
    await storeHandle('my-project', fakeHandle);
    await removeHandle('my-project');
    const result = await getHandle('my-project');
    expect(result).toBeNull();
  });

  it('overwrites existing handle with same key', async () => {
    await storeHandle('my-project', fakeHandle);
    await storeHandle('my-project', fakeHandle2);
    const result = await getHandle('my-project');
    expect(result).toEqual(fakeHandle2);
  });

  it('stores multiple handles independently', async () => {
    await storeHandle('project-a', fakeHandle);
    await storeHandle('project-b', fakeHandle2);
    expect(await getHandle('project-a')).toEqual(fakeHandle);
    expect(await getHandle('project-b')).toEqual(fakeHandle2);
  });
});
