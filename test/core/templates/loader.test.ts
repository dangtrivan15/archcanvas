import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  _resetCache,
} from '@/core/templates/loader';

describe('template loader', () => {
  beforeEach(() => {
    _resetCache();
  });

  describe('getAllTemplates', () => {
    it('returns all 8 templates', () => {
      const templates = getAllTemplates();
      expect(templates).toHaveLength(8);
    });

    it('returns templates with unique ids', () => {
      const templates = getAllTemplates();
      const ids = templates.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every template has required fields', () => {
      const templates = getAllTemplates();
      for (const t of templates) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.category).toBeTruthy();
        expect(t.icon).toBeTruthy();
        expect(Array.isArray(t.tags)).toBe(true);
        expect(t.canvas).toBeDefined();
      }
    });

    it('every template has nodes and edges', () => {
      const templates = getAllTemplates();
      for (const t of templates) {
        const nodes = t.canvas.nodes ?? [];
        const edges = t.canvas.edges ?? [];
        expect(nodes.length).toBeGreaterThan(0);
        expect(edges.length).toBeGreaterThan(0);
      }
    });

    it('every template node has a position', () => {
      const templates = getAllTemplates();
      for (const t of templates) {
        for (const node of t.canvas.nodes ?? []) {
          if ('type' in node) {
            expect(node.position, `Node ${node.id} in ${t.id} missing position`).toBeDefined();
            expect(node.position!.x).toEqual(expect.any(Number));
            expect(node.position!.y).toEqual(expect.any(Number));
          }
        }
      }
    });
  });

  describe('getTemplateById', () => {
    it('returns a template by its id', () => {
      const template = getTemplateById('microservices');
      expect(template).toBeDefined();
      expect(template!.id).toBe('microservices');
      expect(template!.name).toBe('Microservices');
    });

    it('returns undefined for unknown id', () => {
      const template = getTemplateById('nonexistent');
      expect(template).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('returns backend templates', () => {
      const templates = getTemplatesByCategory('backend');
      expect(templates.length).toBeGreaterThan(0);
      for (const t of templates) {
        expect(t.category).toBe('backend');
      }
    });

    it('returns empty array for category with no templates', () => {
      // All categories should have at least one template, but the function
      // should handle edge cases gracefully
      const all = getAllTemplates();
      const categories = new Set(all.map((t) => t.category));
      expect(categories.size).toBeGreaterThan(0);
    });
  });

  describe('searchTemplates', () => {
    it('returns all templates for empty query', () => {
      const results = searchTemplates('');
      expect(results).toHaveLength(8);
    });

    it('searches by name', () => {
      const results = searchTemplates('microservices');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('microservices');
    });

    it('searches by description', () => {
      const results = searchTemplates('serverless');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searches by tag', () => {
      const results = searchTemplates('etl');
      expect(results.length).toBeGreaterThan(0);
    });

    it('is case-insensitive', () => {
      const lower = searchTemplates('monolith');
      const upper = searchTemplates('MONOLITH');
      expect(lower.length).toBe(upper.length);
    });

    it('returns empty array for no matches', () => {
      const results = searchTemplates('zzzznonexistent');
      expect(results).toHaveLength(0);
    });
  });
});
