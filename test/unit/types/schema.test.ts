import { describe, it, expect } from 'vitest';
import {
  PropertyValue,
  PropertyMap,
  Note,
  Position,
  Entity,
  Edge,
  Node,
  CanvasFile,
  RootCanvasFile,
  SubsystemCanvasFile,
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
  it('accepts @root/ reference in endpoint', () => {
    const edge = {
      from: { node: 'handler', port: 'out' },
      to: { node: '@root/db-postgres', port: 'query-in' },
    };
    expect(Edge.parse(edge)).toEqual(edge);
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

describe('CanvasFile', () => {
  it('accepts empty canvas', () => {
    expect(CanvasFile.parse({})).toEqual({});
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
    expect(CanvasFile.parse(canvas)).toEqual(canvas);
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
    expect(CanvasFile.parse(canvas)).toEqual(canvas);
  });
});

describe('RootCanvasFile', () => {
  it('accepts canvas with project metadata', () => {
    const canvas = { project: { name: 'Test' } };
    expect(RootCanvasFile.parse(canvas)).toEqual(canvas);
  });
  it('rejects canvas without project metadata', () => {
    expect(() => RootCanvasFile.parse({})).toThrow(/project/i);
  });
});

describe('SubsystemCanvasFile', () => {
  it('accepts canvas with id and type', () => {
    const canvas = { id: 'svc-api', type: 'compute/service' };
    expect(SubsystemCanvasFile.parse(canvas)).toEqual(canvas);
  });
  it('rejects canvas without id', () => {
    expect(() => SubsystemCanvasFile.parse({ type: 'compute/service' })).toThrow();
  });
  it('rejects canvas without type', () => {
    expect(() => SubsystemCanvasFile.parse({ id: 'svc-api' })).toThrow();
  });
});
