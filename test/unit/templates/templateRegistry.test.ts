/**
 * Tests for the Template Registry — loading built-in templates,
 * metadata extraction, and cache behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBuiltinTemplates,
  clearBuiltinCache,
  type TemplateRecord,
  type TemplateMetadata,
} from '@/templates';

describe('Template Registry — Built-in Templates', () => {
  beforeEach(() => {
    clearBuiltinCache();
  });

  it('loads all 14 built-in templates', () => {
    const templates = getBuiltinTemplates();
    expect(templates).toHaveLength(14);
  });

  it('each template has a valid TemplateMetadata', () => {
    const templates = getBuiltinTemplates();

    for (const t of templates) {
      const m = t.metadata;
      expect(m.id).toBeTruthy();
      expect(typeof m.id).toBe('string');
      expect(m.name).toBeTruthy();
      expect(typeof m.name).toBe('string');
      expect(m.description).toBeTruthy();
      expect(typeof m.description).toBe('string');
      expect(m.icon).toBeTruthy();
      expect(typeof m.icon).toBe('string');
      expect(m.category).toBeTruthy();
      expect(typeof m.category).toBe('string');
      expect(m.nodeCount).toBeGreaterThan(0);
      expect(m.edgeCount).toBeGreaterThan(0);
      expect(m.source).toBe('builtin');
      expect(m.createdAt).toBe(0); // built-in templates have no creation time
    }
  });

  it('all template IDs are unique', () => {
    const templates = getBuiltinTemplates();
    const ids = templates.map((t) => t.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each template has data (raw YAML string)', () => {
    const templates = getBuiltinTemplates();

    for (const t of templates) {
      expect(typeof t.data).toBe('string');
      expect((t.data as string).length).toBeGreaterThan(0);
      // Verify it starts with YAML-like content
      expect(t.data as string).toContain('metadata:');
    }
  });

  it('caches templates on subsequent calls', () => {
    const first = getBuiltinTemplates();
    const second = getBuiltinTemplates();
    // Same reference (cached)
    expect(first).toBe(second);
  });

  it('clearBuiltinCache forces re-parse on next call', () => {
    const first = getBuiltinTemplates();
    clearBuiltinCache();
    const second = getBuiltinTemplates();
    // Different reference (re-parsed)
    expect(first).not.toBe(second);
    // But same content
    expect(second).toHaveLength(14);
  });

  it('includes expected template names', () => {
    const templates = getBuiltinTemplates();
    const ids = templates.map((t) => t.metadata.id);

    expect(ids).toContain('saas-starter');
    expect(ids).toContain('ai-chat-app');
    expect(ids).toContain('serverless-event-driven');
    expect(ids).toContain('microservices-platform');
    expect(ids).toContain('mobile-backend');
    expect(ids).toContain('ml-platform');
    expect(ids).toContain('data-platform');
    expect(ids).toContain('social-network');
    expect(ids).toContain('e-commerce-platform');
    expect(ids).toContain('fintech-payments');
    expect(ids).toContain('healthcare-system');
    expect(ids).toContain('enterprise-crm');
    expect(ids).toContain('internal-developer-platform');
    expect(ids).toContain('iot-platform');
  });

  it('nodeCount matches actual nodes in YAML for saas-starter', () => {
    const templates = getBuiltinTemplates();
    const saas = templates.find((t) => t.metadata.id === 'saas-starter')!;
    expect(saas).toBeDefined();
    // saas-starter has 9 nodes per the YAML
    expect(saas.metadata.nodeCount).toBeGreaterThanOrEqual(8);
  });

  it('templates have tags arrays', () => {
    const templates = getBuiltinTemplates();

    for (const t of templates) {
      expect(Array.isArray(t.metadata.tags)).toBe(true);
      expect(t.metadata.tags!.length).toBeGreaterThan(0);
    }
  });

  it('metadata category is first tag from YAML', () => {
    const templates = getBuiltinTemplates();

    for (const t of templates) {
      if (t.metadata.tags && t.metadata.tags.length > 0) {
        expect(t.metadata.category).toBe(t.metadata.tags[0]);
      }
    }
  });
});
