import { describe, it, expect } from 'vitest';
import { getEntitiesForCanvas, findEntityUsages, listAllEntities } from '../../../src/core/entity/resolver';
import { ROOT_CANVAS_KEY } from '../../../src/storage/fileResolver';

function makeProject(canvases: Record<string, { entities?: any[]; edges?: any[]; nodes?: any[]; displayName?: string }>) {
  const map = new Map<string, any>();
  let root: any = null;

  for (const [id, data] of Object.entries(canvases)) {
    const canvas = {
      filePath: `.archcanvas/${id}.yaml`,
      data: {
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
        entities: data.entities ?? [],
        displayName: data.displayName ?? id,
      },
    };
    if (id === ROOT_CANVAS_KEY) {
      root = canvas;
    } else {
      map.set(id, canvas);
    }
  }
  if (!root) root = { filePath: '.archcanvas/main.yaml', data: { nodes: [], edges: [], entities: [], displayName: 'Root' } };
  return { root, canvases: map, errors: [] };
}

describe('getEntitiesForCanvas', () => {
  it('returns entities for a specific canvas', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: { entities: [{ name: 'Order', description: 'A purchase order' }] },
    });
    const entities = getEntitiesForCanvas(project, ROOT_CANVAS_KEY);
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('Order');
  });

  it('returns empty for canvas with no entities', () => {
    const project = makeProject({ [ROOT_CANVAS_KEY]: {} });
    expect(getEntitiesForCanvas(project, ROOT_CANVAS_KEY)).toHaveLength(0);
  });

  it('returns empty for nonexistent canvas', () => {
    const project = makeProject({ [ROOT_CANVAS_KEY]: {} });
    expect(getEntitiesForCanvas(project, 'nonexistent')).toHaveLength(0);
  });
});

describe('findEntityUsages', () => {
  it('finds entity usages across multiple canvases', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: {
        entities: [{ name: 'Order' }],
        edges: [{ from: { node: 'a' }, to: { node: 'b' }, entities: ['Order'] }],
      },
      'svc-api': {
        edges: [{ from: { node: 'handler' }, to: { node: 'processor' }, entities: ['Order', 'User'] }],
        displayName: 'API Service',
      },
    });
    const usages = findEntityUsages(project, 'Order');
    expect(usages).toHaveLength(2);
    expect(usages.map(u => u.canvasId)).toContain(ROOT_CANVAS_KEY);
    expect(usages.map(u => u.canvasId)).toContain('svc-api');
  });

  it('returns empty for unused entity', () => {
    const project = makeProject({ [ROOT_CANVAS_KEY]: { entities: [{ name: 'Order' }] } });
    expect(findEntityUsages(project, 'Order')).toHaveLength(0);
  });

  it('includes canvas display name in usages', () => {
    const project = makeProject({
      'svc-api': {
        edges: [{ from: { node: 'a' }, to: { node: 'b' }, entities: ['Order'] }],
        displayName: 'API Service',
      },
    });
    const usages = findEntityUsages(project, 'Order');
    expect(usages[0].canvasDisplayName).toBe('API Service');
  });
});

describe('listAllEntities', () => {
  it('lists all entities with definition and reference scopes', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: {
        entities: [{ name: 'Order', description: 'A purchase order' }],
        edges: [{ from: { node: 'a' }, to: { node: 'b' }, entities: ['Order'] }],
      },
      'svc-api': {
        entities: [{ name: 'User' }],
        edges: [{ from: { node: 'x' }, to: { node: 'y' }, entities: ['Order'] }],
      },
    });
    const all = listAllEntities(project);
    expect(all).toHaveLength(2);

    const order = all.find(e => e.name === 'Order')!;
    expect(order.definedIn).toEqual([ROOT_CANVAS_KEY]);
    expect(order.referencedIn).toContain(ROOT_CANVAS_KEY);
    expect(order.referencedIn).toContain('svc-api');
    expect(order.description).toBe('A purchase order');

    const user = all.find(e => e.name === 'User')!;
    expect(user.definedIn).toEqual(['svc-api']);
    expect(user.referencedIn).toHaveLength(0);
  });

  it('returns empty for project with no entities', () => {
    const project = makeProject({ [ROOT_CANVAS_KEY]: {} });
    expect(listAllEntities(project)).toHaveLength(0);
  });

  it('handles entity referenced but not defined', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: {
        edges: [{ from: { node: 'a' }, to: { node: 'b' }, entities: ['Phantom'] }],
      },
    });
    const all = listAllEntities(project);
    expect(all).toHaveLength(1);
    const phantom = all[0];
    expect(phantom.name).toBe('Phantom');
    expect(phantom.definedIn).toHaveLength(0);
    expect(phantom.referencedIn).toEqual([ROOT_CANVAS_KEY]);
  });

  it('handles entity defined in multiple canvases', () => {
    const project = makeProject({
      [ROOT_CANVAS_KEY]: { entities: [{ name: 'Order' }] },
      'svc-api': { entities: [{ name: 'Order', description: 'API Order' }] },
    });
    const all = listAllEntities(project);
    const order = all.find(e => e.name === 'Order')!;
    expect(order.definedIn).toContain(ROOT_CANVAS_KEY);
    expect(order.definedIn).toContain('svc-api');
  });
});
