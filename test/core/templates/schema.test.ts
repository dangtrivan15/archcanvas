import { describe, it, expect } from 'vitest';
import { ArchTemplateSchema } from '@/core/templates/schema';

describe('ArchTemplateSchema', () => {
  it('validates a well-formed template', () => {
    const template = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test architecture template',
      category: 'backend',
      icon: 'Server',
      tags: ['test', 'backend'],
      canvas: {
        nodes: [
          { id: 'svc-1', type: 'compute/service', position: { x: 0, y: 0 } },
        ],
        edges: [],
        entities: [],
      },
    };

    const result = ArchTemplateSchema.safeParse(template);
    expect(result.success).toBe(true);
  });

  it('rejects a template with missing required fields', () => {
    const template = {
      id: 'bad-template',
      // name missing
      description: 'Missing name',
      category: 'backend',
      icon: 'Server',
      tags: [],
      canvas: {},
    };

    const result = ArchTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const template = {
      id: 'bad-category',
      name: 'Bad Category',
      description: 'Invalid category',
      category: 'not-a-real-category',
      icon: 'X',
      tags: [],
      canvas: {},
    };

    const result = ArchTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', () => {
    const categories = ['backend', 'frontend', 'fullstack', 'data', 'devops'];

    for (const category of categories) {
      const template = {
        id: `cat-${category}`,
        name: `${category} Template`,
        description: 'Testing category',
        category,
        icon: 'X',
        tags: [],
        canvas: {},
      };

      const result = ArchTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    }
  });
});
