/**
 * Tests for Template IndexedDB Storage — CRUD operations for user-imported templates.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveImportedTemplate,
  getImportedTemplates,
  getImportedTemplateById,
  deleteImportedTemplate,
  getImportedTemplateCount,
  clearImportedTemplates,
} from '@/templates/storage';
import type { TemplateMetadata } from '@/templates/types';

function makeMetadata(overrides: Partial<TemplateMetadata> = {}): TemplateMetadata {
  return {
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    icon: 'Rocket',
    category: 'test',
    nodeCount: 5,
    edgeCount: 3,
    createdAt: Date.now(),
    source: 'imported' as const,
    tags: ['test', 'unit'],
    ...overrides,
  };
}

function makeData(): Uint8Array {
  return new Uint8Array([0x41, 0x52, 0x43, 0x48, 0x43, 0x00]); // "ARCHC\0"
}

describe('Template IndexedDB Storage', () => {
  beforeEach(async () => {
    await clearImportedTemplates();
  });

  it('saves and retrieves a template', async () => {
    const metadata = makeMetadata();
    const data = makeData();

    await saveImportedTemplate({ metadata, data });

    const result = await getImportedTemplateById('test-template');
    expect(result).not.toBeNull();
    expect(result!.metadata.id).toBe('test-template');
    expect(result!.metadata.name).toBe('Test Template');
    expect(result!.metadata.source).toBe('imported');
    expect(result!.data).toBeInstanceOf(Uint8Array);
  });

  it('returns null for non-existent template', async () => {
    const result = await getImportedTemplateById('non-existent');
    expect(result).toBeNull();
  });

  it('lists all imported templates', async () => {
    await saveImportedTemplate({
      metadata: makeMetadata({ id: 'tmpl-1', name: 'Template 1' }),
      data: makeData(),
    });
    await saveImportedTemplate({
      metadata: makeMetadata({ id: 'tmpl-2', name: 'Template 2' }),
      data: makeData(),
    });
    await saveImportedTemplate({
      metadata: makeMetadata({ id: 'tmpl-3', name: 'Template 3' }),
      data: makeData(),
    });

    const all = await getImportedTemplates();
    expect(all).toHaveLength(3);
    const ids = all.map((t) => t.metadata.id);
    expect(ids).toContain('tmpl-1');
    expect(ids).toContain('tmpl-2');
    expect(ids).toContain('tmpl-3');
  });

  it('replaces existing template with same ID (upsert)', async () => {
    const data1 = makeData();
    const data2 = new Uint8Array([0x01, 0x02, 0x03]);

    await saveImportedTemplate({ metadata: makeMetadata({ name: 'Version 1' }), data: data1 });
    await saveImportedTemplate({ metadata: makeMetadata({ name: 'Version 2' }), data: data2 });

    const all = await getImportedTemplates();
    expect(all).toHaveLength(1);
    expect(all[0].metadata.name).toBe('Version 2');
  });

  it('deletes a template by ID', async () => {
    await saveImportedTemplate({ metadata: makeMetadata({ id: 'to-delete' }), data: makeData() });
    await saveImportedTemplate({ metadata: makeMetadata({ id: 'to-keep' }), data: makeData() });

    await deleteImportedTemplate('to-delete');

    const all = await getImportedTemplates();
    expect(all).toHaveLength(1);
    expect(all[0].metadata.id).toBe('to-keep');
  });

  it('delete non-existent ID does not throw', async () => {
    await expect(deleteImportedTemplate('non-existent')).resolves.toBeUndefined();
  });

  it('counts templates correctly', async () => {
    expect(await getImportedTemplateCount()).toBe(0);

    await saveImportedTemplate({ metadata: makeMetadata({ id: 'a' }), data: makeData() });
    expect(await getImportedTemplateCount()).toBe(1);

    await saveImportedTemplate({ metadata: makeMetadata({ id: 'b' }), data: makeData() });
    expect(await getImportedTemplateCount()).toBe(2);

    await deleteImportedTemplate('a');
    expect(await getImportedTemplateCount()).toBe(1);
  });

  it('clears all templates', async () => {
    await saveImportedTemplate({ metadata: makeMetadata({ id: 'x' }), data: makeData() });
    await saveImportedTemplate({ metadata: makeMetadata({ id: 'y' }), data: makeData() });

    await clearImportedTemplates();

    expect(await getImportedTemplateCount()).toBe(0);
    expect(await getImportedTemplates()).toHaveLength(0);
  });

  it('preserves all metadata fields', async () => {
    const metadata = makeMetadata({
      id: 'full-meta',
      name: 'Full Metadata Test',
      description: 'Tests that all fields survive round-trip',
      icon: 'Brain',
      category: 'enterprise',
      nodeCount: 42,
      edgeCount: 17,
      createdAt: 1700000000000,
      tags: ['alpha', 'beta', 'gamma'],
    });

    await saveImportedTemplate({ metadata, data: makeData() });

    const result = await getImportedTemplateById('full-meta');
    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual(metadata);
  });

  it('handles large data payloads', async () => {
    const largeData = new Uint8Array(100_000); // 100KB
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }

    await saveImportedTemplate({ metadata: makeMetadata({ id: 'large' }), data: largeData });

    const result = await getImportedTemplateById('large');
    expect(result).not.toBeNull();
    expect(result!.data.length).toBe(100_000);
  });
});
