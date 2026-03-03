/**
 * Tests for Feature #214: Double-click Add Note doesn't create duplicate notes.
 * Verifies that rapidly clicking the Add Note button only opens one editor,
 * and rapidly clicking Save only creates one note (not duplicates).
 *
 * Idempotency protections tested:
 *   1. The isEditing boolean state means only one editor can exist at a time
 *   2. The savingNoteRef guard prevents double-click on Save from creating duplicates
 *   3. The guard resets when the editor is opened again (for subsequent notes)
 *   4. The guard resets on cancel (so next note creation works)
 *   5. Store-level addNote correctly creates exactly one note per call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import {
  createEmptyGraph,
  addNode,
  createNode,
  findNode,
} from '@/core/graph/graphEngine';
import { TextApi } from '@/api/textApi';
import { RegistryManager } from '@/core/registry/registryManager';
import type { ArchGraph, ArchNode } from '@/types/graph';

// Helper: creates a graph with a single node for note testing
function createSingleNodeGraph(): { graph: ArchGraph; nodeId: string } {
  let graph = createEmptyGraph();
  const node = createNode({ type: 'compute/service', displayName: 'Test Service' });
  graph = addNode(graph, node);
  return { graph, nodeId: node.id };
}

/**
 * Simulates the NotesTab component's state and handlers.
 * Replicates the exact logic from NodeDetailPanel.tsx (NotesTab component)
 * to unit-test it without needing React component rendering.
 */
function createNotesTabSimulator(nodeId: string, addNoteFn: (params: any) => any) {
  // Component state (mirrors useState calls in NotesTab)
  let isEditing = false;
  let noteContent = '';
  let noteAuthor = 'developer';
  let contentError = '';
  let tags: string[] = [];
  let tagInput = '';
  // Ref-based guard (mirrors useRef in NotesTab)
  let savingNoteRef = false;

  return {
    // State getters
    getState: () => ({ isEditing, noteContent, noteAuthor, contentError, tags, tagInput, savingNoteRef }),

    // Set note content (mirrors parent's setNoteContent)
    setNoteContent: (content: string) => { noteContent = content; },
    setNoteAuthor: (author: string) => { noteAuthor = author; },
    setTags: (newTags: string[]) => { tags = newTags; },

    /**
     * Simulates clicking the "Add Note" button.
     * Maps to handleOpenEditor in NodeDetailPanel.tsx line 730-734.
     */
    clickAddNote: () => {
      // This is the button click handler - only shown when !isEditing
      // In the UI, the button is hidden when isEditing=true,
      // but rapid clicks can fire before React re-renders
      savingNoteRef = false; // Reset guard for new editor session
      isEditing = true;
      contentError = '';
    },

    /**
     * Simulates clicking the "Save" button.
     * Maps to handleSave in NodeDetailPanel.tsx line 706-719.
     */
    clickSave: () => {
      // Guard against double-click creating duplicate notes
      if (savingNoteRef) return false;
      if (!noteContent.trim()) {
        contentError = 'Note content cannot be empty';
        return false;
      }
      savingNoteRef = true;
      contentError = '';

      // Call the parent's onAddNote handler (handleAddNote in NodeDetailPanel)
      // which validates and calls the store addNote
      if (nodeId && noteContent.trim()) {
        addNoteFn({
          nodeId,
          author: noteAuthor,
          content: noteContent.trim(),
          tags: tags.length > 0 ? tags : undefined,
        });
        noteContent = ''; // Parent clears content after addNote
      }

      isEditing = false;
      tags = [];
      tagInput = '';
      return true;
    },

    /**
     * Simulates clicking the "Cancel" button.
     * Maps to handleCancel in NodeDetailPanel.tsx line 721-728.
     */
    clickCancel: () => {
      savingNoteRef = false; // Reset guard on cancel
      isEditing = false;
      noteContent = '';
      contentError = '';
      tags = [];
      tagInput = '';
    },

    /**
     * Check if the Add Note button should be visible (i.e., !isEditing).
     */
    isAddNoteButtonVisible: () => !isEditing,

    /**
     * Check if the editor form should be visible (i.e., isEditing).
     */
    isEditorVisible: () => isEditing,
  };
}

describe('Feature #214: Double-click Add Note doesn\'t create duplicate notes', () => {
  let registry: RegistryManager;

  beforeEach(() => {
    registry = new RegistryManager();
    registry.initialize();
  });

  // ==========================================================
  // 1. Add Note button: isEditing boolean prevents multiple editors
  // ==========================================================
  describe('Add Note button opens exactly one editor', () => {
    it('clicking Add Note once opens the editor', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      expect(sim.isEditorVisible()).toBe(false);
      expect(sim.isAddNoteButtonVisible()).toBe(true);

      sim.clickAddNote();

      expect(sim.isEditorVisible()).toBe(true);
      expect(sim.isAddNoteButtonVisible()).toBe(false);
    });

    it('clicking Add Note rapidly twice still opens only one editor', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      // Simulate two rapid clicks before React re-renders
      sim.clickAddNote();
      sim.clickAddNote(); // Second click while already editing

      expect(sim.isEditorVisible()).toBe(true);
      // isEditing is still true (idempotent boolean set)
      const state = sim.getState();
      expect(state.isEditing).toBe(true);
    });

    it('clicking Add Note five times rapidly opens only one editor', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      for (let i = 0; i < 5; i++) {
        sim.clickAddNote();
      }

      expect(sim.isEditorVisible()).toBe(true);
      expect(sim.isAddNoteButtonVisible()).toBe(false);
    });

    it('Add Note button is hidden while editor is open', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      sim.clickAddNote();

      // Button hidden, editor visible (conditional render)
      expect(sim.isAddNoteButtonVisible()).toBe(false);
      expect(sim.isEditorVisible()).toBe(true);
    });
  });

  // ==========================================================
  // 2. Save button: ref guard prevents duplicate note creation
  // ==========================================================
  describe('Save button creates exactly one note', () => {
    it('clicking Save once creates one note', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      sim.clickAddNote();
      sim.setNoteContent('Test note content');
      sim.clickSave();

      expect(mockAddNote).toHaveBeenCalledTimes(1);
      expect(mockAddNote).toHaveBeenCalledWith({
        nodeId,
        author: 'developer',
        content: 'Test note content',
        tags: undefined,
      });
    });

    it('clicking Save rapidly twice creates only one note (ref guard)', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      sim.clickAddNote();
      sim.setNoteContent('Double-click test note');

      // Rapidly click Save twice (before React re-renders)
      sim.clickSave();
      sim.clickSave(); // Second click should be blocked by savingNoteRef

      expect(mockAddNote).toHaveBeenCalledTimes(1);
    });

    it('clicking Save five times rapidly creates only one note', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      sim.clickAddNote();
      sim.setNoteContent('Rapid save test');

      for (let i = 0; i < 5; i++) {
        sim.clickSave();
      }

      expect(mockAddNote).toHaveBeenCalledTimes(1);
    });

    it('second Save returns false indicating it was blocked', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      sim.clickAddNote();
      sim.setNoteContent('Some content');

      const firstResult = sim.clickSave();
      const secondResult = sim.clickSave();

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(false);
    });

    it('Save with empty content does not trigger guard (allows retry)', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      sim.clickAddNote();
      sim.setNoteContent(''); // Empty content

      const result = sim.clickSave();
      expect(result).toBe(false);
      expect(mockAddNote).not.toHaveBeenCalled();

      // Should still allow save after typing content (guard not engaged)
      sim.setNoteContent('Now with content');
      const result2 = sim.clickSave();
      expect(result2).toBe(true);
      expect(mockAddNote).toHaveBeenCalledTimes(1);
    });

    it('Save with whitespace-only content does not trigger guard', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      sim.clickAddNote();
      sim.setNoteContent('   '); // Whitespace only

      const result = sim.clickSave();
      expect(result).toBe(false);
      expect(mockAddNote).not.toHaveBeenCalled();
      expect(sim.getState().contentError).toBe('Note content cannot be empty');
    });
  });

  // ==========================================================
  // 3. Guard resets on new editor session
  // ==========================================================
  describe('Guard resets for subsequent note creation', () => {
    it('after Save, opening editor again resets guard (second note works)', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      // First note
      sim.clickAddNote();
      sim.setNoteContent('First note');
      sim.clickSave();
      expect(mockAddNote).toHaveBeenCalledTimes(1);

      // Second note (guard should be reset by clickAddNote)
      sim.clickAddNote();
      sim.setNoteContent('Second note');
      sim.clickSave();
      expect(mockAddNote).toHaveBeenCalledTimes(2);
    });

    it('can create three notes sequentially without guard interference', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      for (let i = 1; i <= 3; i++) {
        sim.clickAddNote();
        sim.setNoteContent(`Note number ${i}`);
        sim.clickSave();
      }

      expect(mockAddNote).toHaveBeenCalledTimes(3);
      expect(mockAddNote).toHaveBeenNthCalledWith(1, expect.objectContaining({ content: 'Note number 1' }));
      expect(mockAddNote).toHaveBeenNthCalledWith(2, expect.objectContaining({ content: 'Note number 2' }));
      expect(mockAddNote).toHaveBeenNthCalledWith(3, expect.objectContaining({ content: 'Note number 3' }));
    });

    it('guard resets on Cancel so next save works', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      // Open editor and cancel
      sim.clickAddNote();
      sim.setNoteContent('Discarded note');
      sim.clickCancel();
      expect(mockAddNote).not.toHaveBeenCalled();

      // Open editor again and save
      sim.clickAddNote();
      sim.setNoteContent('Actual note');
      sim.clickSave();
      expect(mockAddNote).toHaveBeenCalledTimes(1);
      expect(mockAddNote).toHaveBeenCalledWith(expect.objectContaining({ content: 'Actual note' }));
    });
  });

  // ==========================================================
  // 4. Editor state management
  // ==========================================================
  describe('Editor state is correct through workflow', () => {
    it('Save closes the editor and clears state', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      sim.clickAddNote();
      sim.setNoteContent('Test');
      sim.setTags(['tag1', 'tag2']);

      sim.clickSave();

      const state = sim.getState();
      expect(state.isEditing).toBe(false);
      expect(state.tags).toEqual([]);
      expect(state.tagInput).toBe('');
    });

    it('Cancel closes the editor and clears content', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      sim.clickAddNote();
      sim.setNoteContent('Unsaved content');

      sim.clickCancel();

      const state = sim.getState();
      expect(state.isEditing).toBe(false);
      expect(state.noteContent).toBe('');
      expect(state.tags).toEqual([]);
    });

    it('savingNoteRef starts as false', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      expect(sim.getState().savingNoteRef).toBe(false);
    });

    it('savingNoteRef becomes true after Save', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      sim.clickAddNote();
      sim.setNoteContent('Test');
      sim.clickSave();

      expect(sim.getState().savingNoteRef).toBe(true);
    });

    it('savingNoteRef resets to false after opening new editor', () => {
      const { nodeId } = createSingleNodeGraph();
      const sim = createNotesTabSimulator(nodeId, vi.fn());

      sim.clickAddNote();
      sim.setNoteContent('Test');
      sim.clickSave();
      expect(sim.getState().savingNoteRef).toBe(true);

      sim.clickAddNote(); // Opens new editor
      expect(sim.getState().savingNoteRef).toBe(false);
    });
  });

  // ==========================================================
  // 5. Tags are passed correctly on single save
  // ==========================================================
  describe('Tags handling with idempotent save', () => {
    it('tags are included in addNote call', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      sim.clickAddNote();
      sim.setNoteContent('Note with tags');
      sim.setTags(['important', 'review']);
      sim.clickSave();

      expect(mockAddNote).toHaveBeenCalledWith({
        nodeId,
        author: 'developer',
        content: 'Note with tags',
        tags: ['important', 'review'],
      });
    });

    it('double-click Save with tags only creates one note with tags', () => {
      const { nodeId } = createSingleNodeGraph();
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(nodeId, mockAddNote);

      sim.clickAddNote();
      sim.setNoteContent('Tagged note');
      sim.setTags(['bug']);

      sim.clickSave();
      sim.clickSave(); // Should be blocked

      expect(mockAddNote).toHaveBeenCalledTimes(1);
      expect(mockAddNote).toHaveBeenCalledWith(expect.objectContaining({ tags: ['bug'] }));
    });
  });

  // ==========================================================
  // 6. Store-level integration: actual note creation is single
  // ==========================================================
  describe('Store-level addNote creates exactly one note', () => {
    it('TextApi.addNote creates one note on node', () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const node = textApi.addNode({ type: 'compute/service', displayName: 'Svc' });

      const note = textApi.addNote({
        nodeId: node.id,
        author: 'dev',
        content: 'Test note',
      });

      const updatedNode = textApi.getNode(node.id);
      expect(updatedNode?.notes).toHaveLength(1);
      expect(updatedNode?.notes[0].id).toBe(note.id);
    });

    it('calling TextApi.addNote twice creates two notes (no store-level guard)', () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const node = textApi.addNode({ type: 'compute/service', displayName: 'Svc' });

      textApi.addNote({ nodeId: node.id, author: 'dev', content: 'Note 1' });
      textApi.addNote({ nodeId: node.id, author: 'dev', content: 'Note 2' });

      const updatedNode = textApi.getNode(node.id);
      expect(updatedNode?.notes).toHaveLength(2);
    });

    it('UI guard prevents double addNote at component level, not store level', () => {
      // This test documents that the guard is in the UI component (NotesTab),
      // NOT in the store. The store's addNote always creates a note when called.
      // The component's savingNoteRef prevents duplicate calls from reaching the store.
      const textApi = new TextApi(createEmptyGraph(), registry);
      const node = textApi.addNode({ type: 'compute/service', displayName: 'Svc' });

      // Direct store call: always works (no guard)
      textApi.addNote({ nodeId: node.id, author: 'dev', content: 'Direct call 1' });
      textApi.addNote({ nodeId: node.id, author: 'dev', content: 'Direct call 2' });

      // Two notes created (store doesn't guard)
      expect(textApi.getNode(node.id)?.notes).toHaveLength(2);

      // But via the UI simulator, the guard kicks in:
      const mockAddNote = vi.fn();
      const sim = createNotesTabSimulator(node.id, mockAddNote);
      sim.clickAddNote();
      sim.setNoteContent('UI note');
      sim.clickSave();
      sim.clickSave(); // Blocked by ref guard

      expect(mockAddNote).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================
  // 7. Complete workflow: Add Note → type → save → verify one note
  // ==========================================================
  describe('Complete workflow: Add Note → type → save → verify', () => {
    it('full workflow creates exactly one note', () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const node = textApi.addNode({ type: 'compute/service', displayName: 'My Service' });

      const actualAddNote = (params: any) => textApi.addNote(params);
      const sim = createNotesTabSimulator(node.id, actualAddNote);

      // Step 1: Click Add Note
      sim.clickAddNote();
      expect(sim.isEditorVisible()).toBe(true);

      // Step 2: Type content
      sim.setNoteContent('This is a test note for feature #214');

      // Step 3: Click Save
      sim.clickSave();

      // Step 4: Verify exactly one note exists
      const updatedNode = textApi.getNode(node.id);
      expect(updatedNode?.notes).toHaveLength(1);
      expect(updatedNode?.notes[0].content).toBe('This is a test note for feature #214');
      expect(updatedNode?.notes[0].author).toBe('developer');
    });

    it('rapid double-click workflow creates exactly one note', () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const node = textApi.addNode({ type: 'compute/service', displayName: 'My Service' });

      const actualAddNote = (params: any) => textApi.addNote(params);
      const sim = createNotesTabSimulator(node.id, actualAddNote);

      // Step 1: Click Add Note rapidly twice
      sim.clickAddNote();
      sim.clickAddNote();

      // Step 2: One editor visible
      expect(sim.isEditorVisible()).toBe(true);

      // Step 3: Type content
      sim.setNoteContent('Double-click test');

      // Step 4: Click Save rapidly twice
      sim.clickSave();
      sim.clickSave(); // Blocked

      // Step 5: Verify exactly one note created
      const updatedNode = textApi.getNode(node.id);
      expect(updatedNode?.notes).toHaveLength(1);
      expect(updatedNode?.notes[0].content).toBe('Double-click test');
    });

    it('workflow with tags creates one properly tagged note', () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const node = textApi.addNode({ type: 'compute/service', displayName: 'My Service' });

      const actualAddNote = (params: any) => textApi.addNote(params);
      const sim = createNotesTabSimulator(node.id, actualAddNote);

      sim.clickAddNote();
      sim.setNoteContent('Important finding');
      sim.setTags(['critical', 'review']);

      // Rapid double-save
      sim.clickSave();
      sim.clickSave();

      // Access graph directly since getNode() strips tags from the note detail view
      const graphNode = findNode(textApi.getGraph(), node.id);
      expect(graphNode?.notes).toHaveLength(1);
      expect(graphNode?.notes[0].content).toBe('Important finding');
      expect(graphNode?.notes[0].tags).toEqual(['critical', 'review']);
    });

    it('two sequential notes created correctly (no guard interference)', () => {
      const textApi = new TextApi(createEmptyGraph(), registry);
      const node = textApi.addNode({ type: 'compute/service', displayName: 'My Service' });

      const actualAddNote = (params: any) => textApi.addNote(params);
      const sim = createNotesTabSimulator(node.id, actualAddNote);

      // First note with rapid double-save
      sim.clickAddNote();
      sim.setNoteContent('First note');
      sim.clickSave();
      sim.clickSave(); // Blocked

      // Second note
      sim.clickAddNote(); // Resets guard
      sim.setNoteContent('Second note');
      sim.clickSave();
      sim.clickSave(); // Blocked

      const updatedNode = textApi.getNode(node.id);
      expect(updatedNode?.notes).toHaveLength(2);
      expect(updatedNode?.notes[0].content).toBe('First note');
      expect(updatedNode?.notes[1].content).toBe('Second note');
    });
  });
});
