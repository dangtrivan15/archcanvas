import { describe, it, expect } from 'vitest';
import { translateToolArgs, TOOL_TO_ACTION } from '../../src/core/ai/translateToolArgs';

describe('TOOL_TO_ACTION', () => {
  it('maps all tool names to action names', () => {
    expect(TOOL_TO_ACTION.add_node).toBe('addNode');
    expect(TOOL_TO_ACTION.add_edge).toBe('addEdge');
    expect(TOOL_TO_ACTION.remove_node).toBe('removeNode');
    expect(TOOL_TO_ACTION.remove_edge).toBe('removeEdge');
    expect(TOOL_TO_ACTION.import_yaml).toBe('import');
    expect(TOOL_TO_ACTION.create_subsystem).toBe('createSubsystem');
    expect(TOOL_TO_ACTION.add_entity).toBe('addEntity');
    expect(TOOL_TO_ACTION.remove_entity).toBe('removeEntity');
    expect(TOOL_TO_ACTION.update_entity).toBe('updateEntity');
    expect(TOOL_TO_ACTION.list).toBe('list');
    expect(TOOL_TO_ACTION.describe).toBe('describe');
    expect(TOOL_TO_ACTION.search).toBe('search');
    expect(TOOL_TO_ACTION.catalog).toBe('catalog');
  });
});

describe('translateToolArgs', () => {
  it('translates add_node: scope → canvasId', () => {
    const { action, translatedArgs } = translateToolArgs('add_node', {
      id: 'svc-1', type: 'compute/service', scope: 'my-canvas',
    });
    expect(action).toBe('addNode');
    expect(translatedArgs.canvasId).toBe('my-canvas');
    expect(translatedArgs).not.toHaveProperty('scope');
  });

  it('defaults scope to __root__', () => {
    const { translatedArgs } = translateToolArgs('add_node', {
      id: 'svc-1', type: 'compute/service',
    });
    expect(translatedArgs.canvasId).toBe('__root__');
  });

  it('passes through add_node optional fields', () => {
    const { translatedArgs } = translateToolArgs('add_node', {
      id: 'svc-1', type: 'compute/service', name: 'My Service', args: '{"port":8080}',
    });
    expect(translatedArgs.name).toBe('My Service');
    expect(translatedArgs.args).toBe('{"port":8080}');
  });

  it('translates add_edge: flat args → nested edge object', () => {
    const { action, translatedArgs } = translateToolArgs('add_edge', {
      from: 'a', to: 'b', protocol: 'HTTP', label: 'call',
    });
    expect(action).toBe('addEdge');
    expect(translatedArgs.edge).toMatchObject({
      from: { node: 'a' }, to: { node: 'b' }, protocol: 'HTTP', label: 'call',
    });
  });

  it('translates add_edge: includes port fields', () => {
    const { translatedArgs } = translateToolArgs('add_edge', {
      from: 'a', to: 'b', fromPort: 'out', toPort: 'in',
    });
    expect(translatedArgs.edge).toMatchObject({
      from: { node: 'a', port: 'out' },
      to: { node: 'b', port: 'in' },
    });
  });

  it('translates remove_node: id → nodeId', () => {
    const { action, translatedArgs } = translateToolArgs('remove_node', { id: 'svc-1' });
    expect(action).toBe('removeNode');
    expect(translatedArgs.nodeId).toBe('svc-1');
    expect(translatedArgs.canvasId).toBe('__root__');
  });

  it('translates remove_edge: passes from/to with canvasId', () => {
    const { action, translatedArgs } = translateToolArgs('remove_edge', {
      from: 'a', to: 'b', scope: 'sub',
    });
    expect(action).toBe('removeEdge');
    expect(translatedArgs).toEqual({ canvasId: 'sub', from: 'a', to: 'b' });
  });

  it('translates import_yaml: parses YAML string', () => {
    const yaml = `nodes:\n  - id: svc-1\n    type: compute/service`;
    const { action, translatedArgs } = translateToolArgs('import_yaml', {
      yaml, scope: 'main',
    });
    expect(action).toBe('import');
    expect(translatedArgs.canvasId).toBe('main');
    expect(translatedArgs.nodes).toBeDefined();
    expect(Array.isArray(translatedArgs.nodes)).toBe(true);
  });

  it('translates create_subsystem', () => {
    const { action, translatedArgs } = translateToolArgs('create_subsystem', {
      id: 'auth-svc', type: 'compute/service', name: 'Auth', scope: 'root',
    });
    expect(action).toBe('createSubsystem');
    expect(translatedArgs).toEqual({ canvasId: 'root', id: 'auth-svc', type: 'compute/service', name: 'Auth' });
  });

  it('translates add_entity', () => {
    const { action, translatedArgs } = translateToolArgs('add_entity', {
      name: 'User', description: 'A user entity', codeRefs: ['src/user.ts'],
    });
    expect(action).toBe('addEntity');
    expect(translatedArgs.name).toBe('User');
    expect(translatedArgs.description).toBe('A user entity');
    expect(translatedArgs.codeRefs).toEqual(['src/user.ts']);
  });

  it('translates remove_entity', () => {
    const { action, translatedArgs } = translateToolArgs('remove_entity', {
      name: 'User', scope: 'sub',
    });
    expect(action).toBe('removeEntity');
    expect(translatedArgs).toEqual({ canvasId: 'sub', entityName: 'User' });
  });

  it('translates update_entity', () => {
    const { action, translatedArgs } = translateToolArgs('update_entity', {
      name: 'User', description: 'Updated', scope: 'sub',
    });
    expect(action).toBe('updateEntity');
    expect(translatedArgs).toEqual({ canvasId: 'sub', entityName: 'User', description: 'Updated' });
  });

  it('passes through read actions with scope → canvasId', () => {
    const { action, translatedArgs } = translateToolArgs('list', {
      scope: 'canvas-1', type: 'nodes',
    });
    expect(action).toBe('list');
    expect(translatedArgs.canvasId).toBe('canvas-1');
    expect(translatedArgs.type).toBe('nodes');
    expect(translatedArgs).not.toHaveProperty('scope');
  });

  it('handles describe with optional id', () => {
    const { action, translatedArgs } = translateToolArgs('describe', {
      id: 'svc-1', scope: 'sub',
    });
    expect(action).toBe('describe');
    expect(translatedArgs).toEqual({ canvasId: 'sub', id: 'svc-1' });
  });

  it('handles search (no scope field)', () => {
    const { action, translatedArgs } = translateToolArgs('search', {
      query: 'service', type: 'nodes',
    });
    expect(action).toBe('search');
    expect(translatedArgs.query).toBe('service');
    expect(translatedArgs.canvasId).toBe('__root__');
  });

  it('handles catalog with namespace', () => {
    const { action, translatedArgs } = translateToolArgs('catalog', {
      namespace: 'compute',
    });
    expect(action).toBe('catalog');
    expect(translatedArgs.namespace).toBe('compute');
    expect(translatedArgs.canvasId).toBe('__root__');
  });

  // --- Project File Tools ---

  it('translates read_project_file', () => {
    const { action, translatedArgs } = translateToolArgs('read_project_file', { path: 'src/app.ts' });
    expect(action).toBe('readProjectFile');
    expect(translatedArgs).toEqual({ path: 'src/app.ts' });
  });

  it('translates write_project_file', () => {
    const { action, translatedArgs } = translateToolArgs('write_project_file', {
      path: 'src/new.ts', content: 'hello',
    });
    expect(action).toBe('writeProjectFile');
    expect(translatedArgs).toEqual({ path: 'src/new.ts', content: 'hello' });
  });

  it('translates update_project_file', () => {
    const { action, translatedArgs } = translateToolArgs('update_project_file', {
      path: 'src/app.ts', old_string: 'foo', new_string: 'bar',
    });
    expect(action).toBe('updateProjectFile');
    expect(translatedArgs).toEqual({ path: 'src/app.ts', oldString: 'foo', newString: 'bar' });
  });

  it('translates list_project_files', () => {
    const { action, translatedArgs } = translateToolArgs('list_project_files', { path: 'src' });
    expect(action).toBe('listProjectFiles');
    expect(translatedArgs).toEqual({ path: 'src' });
  });

  it('translates list_project_files with default path', () => {
    const { action, translatedArgs } = translateToolArgs('list_project_files', {});
    expect(action).toBe('listProjectFiles');
    expect(translatedArgs).toEqual({ path: '.' });
  });

  it('translates glob_project_files', () => {
    const { action, translatedArgs } = translateToolArgs('glob_project_files', {
      pattern: '**/*.ts', path: 'src',
    });
    expect(action).toBe('globProjectFiles');
    expect(translatedArgs).toEqual({ pattern: '**/*.ts', path: 'src' });
  });

  it('translates search_project_files', () => {
    const { action, translatedArgs } = translateToolArgs('search_project_files', {
      query: 'import.*React', path: 'src', include: '*.tsx',
    });
    expect(action).toBe('searchProjectFiles');
    expect(translatedArgs).toEqual({ query: 'import.*React', path: 'src', include: '*.tsx' });
  });

  it('translates delete_project_file', () => {
    const { action, translatedArgs } = translateToolArgs('delete_project_file', { path: 'src/old.ts' });
    expect(action).toBe('deleteProjectFile');
    expect(translatedArgs).toEqual({ path: 'src/old.ts' });
  });
});
