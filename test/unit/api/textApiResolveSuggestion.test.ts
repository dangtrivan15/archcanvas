/**
 * Feature #52: Text API resolveSuggestion() accepts or dismisses suggestion.
 * Verifies that TextAPI.resolveSuggestion() changes a pending suggestion's
 * status to 'accepted' or 'dismissed'.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph } from '@/types/graph';

describe('TextApi.resolveSuggestion() - Feature #52', () => {
  let registry: RegistryManager;

  beforeAll(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  function createApiWithNode() {
    const graph: ArchGraph = {
      name: 'Test',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
    const textApi = new TextApi(graph, registry);
    const node = textApi.addNode({
      type: 'compute/service',
      displayName: 'Test Service',
    });
    return { textApi, nodeId: node.id };
  }

  describe('accepting a suggestion', () => {
    it('should change note status from pending to accepted', () => {
      const { textApi, nodeId } = createApiWithNode();

      // Create a pending suggestion
      const note = textApi.suggest({
        nodeId,
        content: 'Consider adding caching',
        suggestionType: 'improvement',
      });

      // Verify initial status is pending
      let detail = textApi.getNode(nodeId);
      expect(detail!.notes[0].status).toBe('pending');

      // Accept the suggestion
      textApi.resolveSuggestion(nodeId, note.id, 'accepted');

      // Verify status changed to accepted
      detail = textApi.getNode(nodeId);
      expect(detail!.notes[0].status).toBe('accepted');
    });

    it('should preserve other note properties when accepting', () => {
      const { textApi, nodeId } = createApiWithNode();

      const note = textApi.suggest({
        nodeId,
        content: 'Use connection pooling',
        suggestionType: 'performance',
      });

      textApi.resolveSuggestion(nodeId, note.id, 'accepted');

      const detail = textApi.getNode(nodeId);
      expect(detail!.notes[0].author).toBe('ai');
      expect(detail!.notes[0].content).toBe('Use connection pooling');
      expect(detail!.notes[0].id).toBe(note.id);
    });
  });

  describe('dismissing a suggestion', () => {
    it('should change note status from pending to dismissed', () => {
      const { textApi, nodeId } = createApiWithNode();

      // Create a pending suggestion
      const note = textApi.suggest({
        nodeId,
        content: 'Rewrite in Rust',
        suggestionType: 'improvement',
      });

      // Verify initial status is pending
      let detail = textApi.getNode(nodeId);
      expect(detail!.notes[0].status).toBe('pending');

      // Dismiss the suggestion
      textApi.resolveSuggestion(nodeId, note.id, 'dismissed');

      // Verify status changed to dismissed
      detail = textApi.getNode(nodeId);
      expect(detail!.notes[0].status).toBe('dismissed');
    });

    it('should preserve other note properties when dismissing', () => {
      const { textApi, nodeId } = createApiWithNode();

      const note = textApi.suggest({
        nodeId,
        content: 'Add monitoring',
        suggestionType: 'observability',
      });

      textApi.resolveSuggestion(nodeId, note.id, 'dismissed');

      const detail = textApi.getNode(nodeId);
      expect(detail!.notes[0].author).toBe('ai');
      expect(detail!.notes[0].content).toBe('Add monitoring');
      expect(detail!.notes[0].id).toBe(note.id);
    });
  });

  describe('resolving specific suggestions among multiple', () => {
    it('should only change the targeted note, not other notes', () => {
      const { textApi, nodeId } = createApiWithNode();

      const note1 = textApi.suggest({ nodeId, content: 'Suggestion 1', suggestionType: 'a' });
      const note2 = textApi.suggest({ nodeId, content: 'Suggestion 2', suggestionType: 'b' });
      const note3 = textApi.suggest({ nodeId, content: 'Suggestion 3', suggestionType: 'c' });

      // Accept only the second suggestion
      textApi.resolveSuggestion(nodeId, note2.id, 'accepted');

      const detail = textApi.getNode(nodeId);
      const notes = detail!.notes;
      expect(notes.length).toBe(3);

      const n1 = notes.find((n) => n.id === note1.id);
      const n2 = notes.find((n) => n.id === note2.id);
      const n3 = notes.find((n) => n.id === note3.id);

      expect(n1!.status).toBe('pending');
      expect(n2!.status).toBe('accepted');
      expect(n3!.status).toBe('pending');
    });

    it('should allow accepting one and dismissing another', () => {
      const { textApi, nodeId } = createApiWithNode();

      const note1 = textApi.suggest({
        nodeId,
        content: 'Good idea',
        suggestionType: 'improvement',
      });
      const note2 = textApi.suggest({ nodeId, content: 'Bad idea', suggestionType: 'improvement' });

      textApi.resolveSuggestion(nodeId, note1.id, 'accepted');
      textApi.resolveSuggestion(nodeId, note2.id, 'dismissed');

      const detail = textApi.getNode(nodeId);
      const n1 = detail!.notes.find((n) => n.id === note1.id);
      const n2 = detail!.notes.find((n) => n.id === note2.id);

      expect(n1!.status).toBe('accepted');
      expect(n2!.status).toBe('dismissed');
    });
  });

  describe('end-to-end flow matching feature steps', () => {
    it('full workflow: create pending → accept, create pending → dismiss', () => {
      const { textApi, nodeId } = createApiWithNode();

      // Step 1: Create a pending suggestion note on a node
      const suggestion1 = textApi.suggest({
        nodeId,
        content: 'Add rate limiting',
        suggestionType: 'security',
      });

      // Step 2: Call resolveSuggestion(noteId, 'accepted')
      textApi.resolveSuggestion(nodeId, suggestion1.id, 'accepted');

      // Step 3: Verify note.status changed to 'accepted'
      let detail = textApi.getNode(nodeId);
      const acceptedNote = detail!.notes.find((n) => n.id === suggestion1.id);
      expect(acceptedNote!.status).toBe('accepted');

      // Step 4: Create another pending suggestion
      const suggestion2 = textApi.suggest({
        nodeId,
        content: 'Use microservices pattern',
        suggestionType: 'architecture',
      });

      // Step 5: Call resolveSuggestion(noteId2, 'dismissed')
      textApi.resolveSuggestion(nodeId, suggestion2.id, 'dismissed');

      // Step 6: Verify note.status changed to 'dismissed'
      detail = textApi.getNode(nodeId);
      const dismissedNote = detail!.notes.find((n) => n.id === suggestion2.id);
      expect(dismissedNote!.status).toBe('dismissed');
    });
  });
});
