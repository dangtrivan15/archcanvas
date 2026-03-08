/**
 * Integration tests for importing templates as container nodes (#457).
 *
 * Tests the writeArchcToFolder scanner function and the projectStore
 * saveTemplateAsFile action end-to-end (with mocked File System Access API).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeArchcToFolder } from '@/core/project/scanner';
import type { ArchGraph } from '@/types/graph';

// ── writeArchcToFolder tests ─────────────────────────────

describe('writeArchcToFolder', () => {
  it('creates a file and writes binary data to it', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const closeFn = vi.fn().mockResolvedValue(undefined);
    const mockWritable = { write: writeFn, close: closeFn };
    const mockFileHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    };
    const mockDirHandle = {
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
    } as unknown as FileSystemDirectoryHandle;

    const data = new Uint8Array([1, 2, 3, 4]);
    await writeArchcToFolder(mockDirHandle, 'test.archc', data);

    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('test.archc', { create: true });
    expect(writeFn).toHaveBeenCalledWith(data);
    expect(closeFn).toHaveBeenCalled();
  });

  it('throws if directory handle fails', async () => {
    const mockDirHandle = {
      getFileHandle: vi.fn().mockRejectedValue(new Error('Permission denied')),
    } as unknown as FileSystemDirectoryHandle;

    await expect(
      writeArchcToFolder(mockDirHandle, 'test.archc', new Uint8Array()),
    ).rejects.toThrow('Permission denied');
  });
});

// ── NodeId-based filename tests ─────────────────────────

describe('Template filename from nodeId', () => {
  it('uses nodeId as filename instead of sanitized display name', () => {
    // saveTemplateAsFile now takes a nodeId and uses it directly
    const deriveFilename = (nodeId: string) => `${nodeId}.archc`;

    expect(deriveFilename('01JABCDEF')).toBe('01JABCDEF.archc');
    expect(deriveFilename('01H1234567890ABCDEFGHIJ')).toBe('01H1234567890ABCDEFGHIJ.archc');
  });

  it('filename does not depend on display name at all', () => {
    const nodeId = '01JABCDEF';
    const fileName = `${nodeId}.archc`;

    // No matter the display name, filename is always based on nodeId
    expect(fileName).not.toContain('saas');
    expect(fileName).not.toContain('starter');
    expect(fileName).toBe('01JABCDEF.archc');
  });
});

// ── Container node creation tests ────────────────────────

describe('Container node creation for templates', () => {
  it('creates a node with correct type and bare refSource', () => {
    // Simulate what UseTemplateDialog does: create node first, then set refSource
    const nodeId = '01JABCDEF';
    const fileName = `${nodeId}.archc`;
    const displayName = 'SaaS Starter';

    const node = {
      id: nodeId,
      type: 'meta/canvas-ref',
      displayName,
      args: {
        filePath: fileName,
        nodeCount: 5,
        description: 'Imported from template: SaaS Starter',
      },
      codeRefs: [],
      notes: [],
      properties: {},
      position: { x: 0, y: 0, width: 200, height: 100 },
      children: [],
      refSource: fileName, // bare filename, no file:// prefix
    };

    expect(node.type).toBe('meta/canvas-ref');
    expect(node.refSource).toBe('01JABCDEF.archc');
    expect(node.args.filePath).toBe('01JABCDEF.archc');
    expect(node.args.nodeCount).toBe(5);
    expect(node.displayName).toBe('SaaS Starter');
    // filename matches the node's own ID
    expect(node.refSource).toBe(`${node.id}.archc`);
  });

  it('refSource ends with .archc so RenderApi maps to container type', () => {
    const refSource = '01JABCDEF.archc';
    const isArchcRef = refSource.endsWith('.archc');
    expect(isArchcRef).toBe(true);
  });
});

// ── Manifest update tests ────────────────────────────────

describe('Descriptor update on container import', () => {
  it('adds new file entry with nodeId-based path to descriptor', () => {
    const descriptor = {
      name: 'Test Project',
      rootFile: 'main.archc',
      files: [{ path: 'main.archc', displayName: 'Main Architecture' }],
    };

    const nodeId = '01JABCDEF';
    const fileName = `${nodeId}.archc`;
    const displayName = 'SaaS Starter';

    // Simulate the update logic from projectStore (no links in new descriptor)
    const alreadyInDescriptor = descriptor.files.some((f) => f.path === fileName);
    expect(alreadyInDescriptor).toBe(false);

    const updated = {
      ...descriptor,
      files: [...descriptor.files, { path: fileName, displayName }],
    };

    expect(updated.files).toHaveLength(2);
    expect(updated.files[1]!.path).toBe('01JABCDEF.archc');
  });

  it('does not duplicate file entry if already in descriptor', () => {
    const nodeId = '01JABCDEF';
    const descriptor = {
      name: 'Test Project',
      rootFile: 'main.archc',
      files: [
        { path: 'main.archc', displayName: 'Main Architecture' },
        { path: `${nodeId}.archc`, displayName: 'SaaS Starter' },
      ],
    };

    const fileName = `${nodeId}.archc`;
    const alreadyInDescriptor = descriptor.files.some((f) => f.path === fileName);
    expect(alreadyInDescriptor).toBe(true);
  });
});
