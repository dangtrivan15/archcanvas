import { describe, it, expect } from 'vitest';
import {
  PropertyValue,
  PropertyMap,
  Note,
  Position,
  Entity,
  Edge,
  InlineNode,
  Node,
  Canvas,
  RootCanvas,
  SubsystemCanvas,
} from '@/types';

describe('PropertyValue', () => {
  it('accepts string', () => {
    expect(PropertyValue.parse('hello')).toBe('hello');
  });
  it('accepts number', () => {
    expect(PropertyValue.parse(42)).toBe(42);
  });
  it('accepts boolean', () => {
    expect(PropertyValue.parse(true)).toBe(true);
  });
  it('accepts string array', () => {
    expect(PropertyValue.parse(['a', 'b'])).toEqual(['a', 'b']);
  });
  it('rejects object', () => {
    expect(() => PropertyValue.parse({ key: 'val' })).toThrow();
  });
  it('rejects mixed array', () => {
    expect(() => PropertyValue.parse(['a', 1])).toThrow();
  });
});

describe('PropertyMap', () => {
  it('accepts valid map', () => {
    const input = { language: 'TypeScript', replicas: 2, enabled: true, tags: ['a'] };
    expect(PropertyMap.parse(input)).toEqual(input);
  });
  it('rejects nested objects', () => {
    expect(() => PropertyMap.parse({ nested: { a: 1 } })).toThrow();
  });
});

describe('Note', () => {
  it('accepts minimal note', () => {
    expect(Note.parse({ author: 'van', content: 'test' })).toEqual({
      author: 'van',
      content: 'test',
    });
  });
  it('accepts note with tags', () => {
    const note = { author: 'van', content: 'test', tags: ['reliability'] };
    expect(Note.parse(note)).toEqual(note);
  });
  it('rejects missing author', () => {
    expect(() => Note.parse({ content: 'test' })).toThrow();
  });
  it('rejects missing content', () => {
    expect(() => Note.parse({ author: 'van' })).toThrow();
  });

  it('accepts note with id and createdAt', () => {
    const note = {
      id: 'abc-123',
      author: 'van',
      content: 'test',
      createdAt: '2026-03-12T10:00:00.000Z',
    };
    expect(Note.parse(note)).toEqual(note);
  });

  it('accepts note with id only (createdAt optional)', () => {
    const note = { id: 'abc-123', author: 'van', content: 'test' };
    expect(Note.parse(note)).toEqual(note);
  });

  it('preserves existing notes without id or createdAt', () => {
    const legacy = { author: 'van', content: 'old note' };
    const parsed = Note.parse(legacy);
    expect(parsed).toEqual(legacy);
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('createdAt');
  });
});

describe('Position', () => {
  it('accepts x, y only', () => {
    expect(Position.parse({ x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
  });
  it('accepts full position', () => {
    const pos = { x: 100, y: 200, width: 300, height: 150 };
    expect(Position.parse(pos)).toEqual(pos);
  });
});

describe('Position.autoSize', () => {
  it('accepts autoSize boolean', () => {
    const result = Position.safeParse({ x: 10, y: 20, autoSize: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.autoSize).toBe(true);
  });

  it('autoSize is optional (defaults to undefined)', () => {
    const result = Position.safeParse({ x: 10, y: 20 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.autoSize).toBeUndefined();
  });

  it('round-trips with width, height, and autoSize', () => {
    const input = { x: 0, y: 0, width: 240, height: 160, autoSize: false };
    const result = Position.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(input);
  });
});

describe('Entity', () => {
  it('accepts minimal entity', () => {
    expect(Entity.parse({ name: 'Order' })).toEqual({ name: 'Order' });
  });
  it('accepts full entity', () => {
    const entity = {
      name: 'Order',
      description: 'Purchase order',
      codeRefs: ['src/domain/order/'],
    };
    expect(Entity.parse(entity)).toEqual(entity);
  });
});

describe('Edge', () => {
  it('accepts minimal edge', () => {
    const edge = {
      from: { node: 'svc-api' },
      to: { node: 'db-postgres' },
    };
    expect(Edge.parse(edge)).toEqual(edge);
  });
  it('accepts full edge', () => {
    const edge = {
      from: { node: 'svc-api', port: 'http-out' },
      to: { node: 'db-postgres', port: 'query-in' },
      protocol: 'SQL',
      label: 'persist orders',
      entities: ['Order'],
      notes: [{ author: 'van', content: 'needs optimization' }],
    };
    expect(Edge.parse(edge)).toEqual(edge);
  });
  it('accepts @<ref-node-id>/ cross-scope reference in endpoint', () => {
    const edge = {
      from: { node: 'handler', port: 'out' },
      to: { node: '@order-service/db-postgres', port: 'query-in' },
    };
    expect(Edge.parse(edge)).toEqual(edge);
  });
});

describe('InlineNode color validation', () => {
  it('accepts a valid 6-digit hex color', () => {
    const node = { id: 'n1', type: 'compute/service', color: '#ff6b6b' };
    const result = InlineNode.safeParse(node);
    expect(result.success).toBe(true);
  });

  it('accepts lowercase hex color', () => {
    const node = { id: 'n1', type: 'compute/service', color: '#abcdef' };
    expect(InlineNode.safeParse(node).success).toBe(true);
  });

  it('accepts uppercase hex color', () => {
    const node = { id: 'n1', type: 'compute/service', color: '#ABCDEF' };
    expect(InlineNode.safeParse(node).success).toBe(true);
  });

  it('accepts node without color (optional)', () => {
    const node = { id: 'n1', type: 'compute/service' };
    expect(InlineNode.safeParse(node).success).toBe(true);
  });

  it('rejects non-hex string', () => {
    const node = { id: 'n1', type: 'compute/service', color: 'red' };
    expect(InlineNode.safeParse(node).success).toBe(false);
  });

  it('rejects 3-digit hex shorthand', () => {
    const node = { id: 'n1', type: 'compute/service', color: '#f00' };
    expect(InlineNode.safeParse(node).success).toBe(false);
  });

  it('rejects hex without # prefix', () => {
    const node = { id: 'n1', type: 'compute/service', color: 'ff6b6b' };
    expect(InlineNode.safeParse(node).success).toBe(false);
  });

  it('rejects empty string', () => {
    const node = { id: 'n1', type: 'compute/service', color: '' };
    expect(InlineNode.safeParse(node).success).toBe(false);
  });
});

describe('Node union', () => {
  it('parses RefNode when ref is present', () => {
    const node = { id: 'svc-api', ref: 'svc-api' };
    const result = Node.parse(node);
    expect(result).toEqual(node);
    expect('ref' in result).toBe(true);
  });
  it('parses InlineNode when type is present', () => {
    const node = {
      id: 'db-postgres',
      type: 'data/database',
      displayName: 'PostgreSQL',
      args: { engine: 'PostgreSQL', version: '16' },
    };
    const result = Node.parse(node);
    expect(result).toEqual(node);
    expect('type' in result).toBe(true);
  });
  it('InlineNode accepts position', () => {
    const node = {
      id: 'svc-api',
      type: 'compute/service',
      position: { x: 0, y: 0, width: 200, height: 100 },
    };
    expect(Node.parse(node)).toEqual(node);
  });
  it('RefNode accepts position', () => {
    const node = { id: 'svc-api', ref: 'svc-api', position: { x: 50, y: 50 } };
    expect(Node.parse(node)).toEqual(node);
  });
});

describe('Canvas', () => {
  it('accepts empty canvas', () => {
    expect(Canvas.parse({})).toEqual({});
  });
  it('accepts root canvas with project metadata', () => {
    const canvas = {
      project: { name: 'Test', description: 'A test project' },
      nodes: [
        { id: 'svc-api', type: 'compute/service', displayName: 'API' },
      ],
      entities: [{ name: 'User' }],
      edges: [
        { from: { node: 'svc-api' }, to: { node: 'db' } },
      ],
    };
    expect(Canvas.parse(canvas)).toEqual(canvas);
  });
  it('accepts subsystem canvas with identity', () => {
    const canvas = {
      id: 'svc-api',
      type: 'compute/service',
      displayName: 'API Service',
      description: 'Main API',
      args: { language: 'TypeScript', framework: 'Express' },
      codeRefs: ['src/services/api/'],
      nodes: [
        { id: 'handler', type: 'compute/function', displayName: 'Handler' },
      ],
    };
    expect(Canvas.parse(canvas)).toEqual(canvas);
  });
});

describe('RootCanvas', () => {
  it('accepts canvas with project metadata', () => {
    const canvas = { project: { name: 'Test' } };
    expect(RootCanvas.parse(canvas)).toEqual(canvas);
  });
  it('rejects canvas without project metadata', () => {
    expect(() => RootCanvas.parse({})).toThrow(/project/i);
  });
});

describe('SubsystemCanvas', () => {
  it('accepts canvas with type only (no id)', () => {
    const canvas = {
      type: 'compute/service',
      displayName: 'Order Service',
      nodes: [],
      edges: [],
    };
    const result = SubsystemCanvas.safeParse(canvas);
    expect(result.success).toBe(true);
  });

  it('accepts canvas with id and type', () => {
    const canvas = { id: 'svc-api', type: 'compute/service' };
    expect(SubsystemCanvas.parse(canvas)).toEqual(canvas);
  });

  it('rejects canvas without type field', () => {
    const canvas = {
      displayName: 'Order Service',
      nodes: [],
      edges: [],
    };
    const result = SubsystemCanvas.safeParse(canvas);
    expect(result.success).toBe(false);
  });
});
