/**
 * Feature #51: Text API suggest() creates pending AI suggestion.
 * Verifies that TextAPI.suggest() creates a note with status='pending'
 * and author='ai' on the target node.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode } from '@/types/graph';
import { generateId } from '@/utils/idGenerator';

function makeNode(overrides: Partial<ArchNode> & { type: string; displayName: string }): ArchNode {
  return {
    id: generateId(),
    type: overrides.type,
    displayName: overrides.displayName,
    args: overrides.args ?? {},
    codeRefs: overrides.codeRefs ?? [],
    notes: overrides.notes ?? [],
    properties: overrides.properties ?? {},
    position: overrides.position ?? { x: 0, y: 0, width: 200, height: 100 },
    children: overrides.children ?? [],
    refSource: overrides.refSource,
  };
}

describe('TextApi.suggest() - Feature #51', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  describe('basic suggest() creates a pending AI note', () => {
    it('should create a note with author "ai"', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'My Service' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      textApi.suggest({
        nodeId: node.id,
        content: 'Consider adding caching',
        suggestionType: 'improvement',
      });

      const detail = textApi.getNode(node.id);
      expect(detail).toBeDefined();
      expect(detail!.notes.length).toBe(1);
      expect(detail!.notes[0].author).toBe('ai');
    });

    it('should create a note with status "pending"', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'My Service' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      textApi.suggest({
        nodeId: node.id,
        content: 'Consider adding caching',
        suggestionType: 'improvement',
      });

      const detail = textApi.getNode(node.id);
      expect(detail!.notes[0].status).toBe('pending');
    });

    it('should create a note whose content matches the suggestion content', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'My Service' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const content = 'Consider adding caching';
      textApi.suggest({
        nodeId: node.id,
        content,
        suggestionType: 'improvement',
      });

      const detail = textApi.getNode(node.id);
      expect(detail!.notes[0].content).toBe(content);
    });

    it('should return the created note from suggest()', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'My Service' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const note = textApi.suggest({
        nodeId: node.id,
        content: 'Use a read replica for better performance',
        suggestionType: 'performance',
      });

      expect(note).toBeDefined();
      expect(note.id).toBeTruthy();
      expect(note.author).toBe('ai');
      expect(note.status).toBe('pending');
      expect(note.content).toBe('Use a read replica for better performance');
    });
  });

  describe('suggest() with different suggestion types', () => {
    it('should store suggestionType on the returned note', () => {
      const node = makeNode({ type: 'data/database', displayName: 'DB' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const note = textApi.suggest({
        nodeId: node.id,
        content: 'Add indexes',
        suggestionType: 'optimization',
      });

      // suggestionType is stored on the note object (not exposed in NodeDetail but on the raw Note)
      expect(note.suggestionType).toBe('optimization');
    });

    it('should work without suggestionType (optional)', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const note = textApi.suggest({
        nodeId: node.id,
        content: 'General suggestion',
      });

      expect(note.author).toBe('ai');
      expect(note.status).toBe('pending');
      expect(note.content).toBe('General suggestion');
      expect(note.suggestionType).toBeUndefined();
    });
  });

  describe('suggest() with existing notes', () => {
    it('should add suggestion note alongside existing notes', () => {
      const node = makeNode({
        type: 'compute/service',
        displayName: 'My Service',
        notes: [
          {
            id: 'existing-note-1',
            author: 'human',
            timestampMs: Date.now(),
            content: 'Existing human note',
            tags: [],
            status: 'none',
          },
        ],
      });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      textApi.suggest({
        nodeId: node.id,
        content: 'AI suggestion',
        suggestionType: 'improvement',
      });

      const detail = textApi.getNode(node.id);
      expect(detail!.notes.length).toBe(2);

      const humanNote = detail!.notes.find((n) => n.author === 'human');
      const aiNote = detail!.notes.find((n) => n.author === 'ai');
      expect(humanNote).toBeDefined();
      expect(aiNote).toBeDefined();
      expect(aiNote!.status).toBe('pending');
    });

    it('should allow multiple AI suggestions on the same node', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      textApi.suggest({ nodeId: node.id, content: 'Suggestion 1', suggestionType: 'improvement' });
      textApi.suggest({ nodeId: node.id, content: 'Suggestion 2', suggestionType: 'security' });
      textApi.suggest({ nodeId: node.id, content: 'Suggestion 3', suggestionType: 'performance' });

      const detail = textApi.getNode(node.id);
      expect(detail!.notes.length).toBe(3);

      const allAi = detail!.notes.every((n) => n.author === 'ai');
      expect(allAi).toBe(true);

      const allPending = detail!.notes.every((n) => n.status === 'pending');
      expect(allPending).toBe(true);

      expect(detail!.notes.map((n) => n.content)).toEqual([
        'Suggestion 1',
        'Suggestion 2',
        'Suggestion 3',
      ]);
    });
  });

  describe('suggest() note properties', () => {
    it('should generate a unique id for the note', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const note1 = textApi.suggest({ nodeId: node.id, content: 'A' });
      const note2 = textApi.suggest({ nodeId: node.id, content: 'B' });

      expect(note1.id).not.toBe(note2.id);
      expect(note1.id.length).toBeGreaterThan(0);
      expect(note2.id.length).toBeGreaterThan(0);
    });

    it('should set a timestamp on the note', () => {
      const before = Date.now();
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const note = textApi.suggest({ nodeId: node.id, content: 'Timed suggestion' });
      const after = Date.now();

      expect(note.timestampMs).toBeGreaterThanOrEqual(before);
      expect(note.timestampMs).toBeLessThanOrEqual(after);
    });

    it('should have empty tags array', () => {
      const node = makeNode({ type: 'compute/service', displayName: 'Svc' });
      const graph: ArchGraph = {
        name: 'Test',
        description: '',
        owners: [],
        nodes: [node],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      const note = textApi.suggest({ nodeId: node.id, content: 'Suggestion' });

      expect(note.tags).toEqual([]);
    });
  });

  describe('suggest() end-to-end flow', () => {
    it('full workflow: create node, suggest, getNode, verify note', () => {
      const graph: ArchGraph = {
        name: 'E2E Test',
        description: '',
        owners: [],
        nodes: [],
        edges: [],
      };
      const textApi = new TextApi(graph, registry);

      // Step 1: Create a node
      const node = textApi.addNode({
        type: 'compute/service',
        displayName: 'User Service',
      });

      // Step 2: Call suggest
      textApi.suggest({
        nodeId: node.id,
        content: 'Consider adding caching',
        suggestionType: 'improvement',
      });

      // Step 3: Call getNode
      const detail = textApi.getNode(node.id);

      // Step 4: Verify a new note exists with author='ai'
      expect(detail).toBeDefined();
      expect(detail!.notes.length).toBe(1);
      expect(detail!.notes[0].author).toBe('ai');

      // Step 5: Verify note.status is 'pending'
      expect(detail!.notes[0].status).toBe('pending');

      // Step 6: Verify note.content matches suggestion content
      expect(detail!.notes[0].content).toBe('Consider adding caching');
    });
  });
});
