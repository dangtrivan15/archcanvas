/**
 * NodeDetailPanel - shows selected node details in the right panel.
 * Tabs: Properties, Notes, Code Refs, AI Chat.
 * Used to verify node data (id, type, displayName, args, notes, codeRefs, children).
 */

import { useMemo, useState, useCallback } from 'react';
import { X, Plus, MessageSquare, FileCode, Settings, StickyNote } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { findNode } from '@/core/graph/graphEngine';

type Tab = 'properties' | 'notes' | 'coderefs' | 'aichat';

export function NodeDetailPanel() {
  const graph = useCoreStore((s) => s.graph);
  const addNote = useCoreStore((s) => s.addNote);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  const [activeTab, setActiveTab] = useState<Tab>('properties');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('developer');

  const node = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNode(graph, selectedNodeId);
  }, [graph, selectedNodeId]);

  const handleAddNote = useCallback(() => {
    if (!selectedNodeId || !noteContent.trim()) return;
    addNote({
      nodeId: selectedNodeId,
      author: noteAuthor,
      content: noteContent.trim(),
    });
    setNoteContent('');
  }, [selectedNodeId, noteContent, noteAuthor, addNote]);

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400 p-4">
        Select a node to view details
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="node-detail-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate" data-testid="detail-node-name">
            {node.displayName}
          </div>
          <div className="text-xs text-gray-400 truncate" data-testid="detail-node-type">
            {node.type}
          </div>
        </div>
        <button
          onClick={closeRightPanel}
          className="p-1 rounded hover:bg-gray-200 text-gray-400"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { key: 'properties' as Tab, icon: Settings, label: 'Properties' },
          { key: 'notes' as Tab, icon: StickyNote, label: 'Notes' },
          { key: 'coderefs' as Tab, icon: FileCode, label: 'Code Refs' },
          { key: 'aichat' as Tab, icon: MessageSquare, label: 'AI Chat' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors
              ${activeTab === key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            data-testid={`tab-${key}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'properties' && (
          <PropertiesTab node={node} />
        )}
        {activeTab === 'notes' && (
          <NotesTab
            node={node}
            noteContent={noteContent}
            noteAuthor={noteAuthor}
            onNoteContentChange={setNoteContent}
            onNoteAuthorChange={setNoteAuthor}
            onAddNote={handleAddNote}
          />
        )}
        {activeTab === 'coderefs' && (
          <CodeRefsTab node={node} />
        )}
        {activeTab === 'aichat' && (
          <div className="text-sm text-gray-400 text-center py-8">
            AI Chat - coming soon
          </div>
        )}
      </div>
    </div>
  );
}

function PropertiesTab({ node }: { node: NonNullable<ReturnType<typeof findNode>> }) {
  return (
    <div className="space-y-4" data-testid="properties-tab">
      {/* Node ID */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">ID</label>
        <div className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded break-all" data-testid="detail-node-id">
          {node.id}
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</label>
        <div className="mt-1 text-sm" data-testid="detail-display-name">
          {node.displayName}
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</label>
        <div className="mt-1 text-sm font-mono" data-testid="detail-type">
          {node.type}
        </div>
      </div>

      {/* Args */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Arguments</label>
        <div className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded" data-testid="detail-args">
          {Object.keys(node.args).length === 0
            ? <span className="text-gray-400">empty object {'{}'}</span>
            : JSON.stringify(node.args, null, 2)
          }
        </div>
      </div>

      {/* Properties */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Properties</label>
        <div className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded" data-testid="detail-properties">
          {Object.keys(node.properties).length === 0
            ? <span className="text-gray-400">empty object {'{}'}</span>
            : JSON.stringify(node.properties, null, 2)
          }
        </div>
      </div>

      {/* Children */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Children ({node.children.length})
        </label>
        <div className="mt-1 text-xs" data-testid="detail-children">
          {node.children.length === 0
            ? <span className="text-gray-400">empty array []</span>
            : node.children.map((child) => (
                <div key={child.id} className="bg-gray-50 px-2 py-1 rounded mt-1">
                  {child.displayName} ({child.type})
                </div>
              ))
          }
        </div>
      </div>

      {/* Notes count */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Notes ({node.notes.length})
        </label>
        <div className="mt-1 text-xs" data-testid="detail-notes-count">
          {node.notes.length === 0
            ? <span className="text-gray-400">empty array []</span>
            : <span>{node.notes.length} note(s)</span>
          }
        </div>
      </div>

      {/* Code Refs count */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Code References ({node.codeRefs.length})
        </label>
        <div className="mt-1 text-xs" data-testid="detail-coderefs-count">
          {node.codeRefs.length === 0
            ? <span className="text-gray-400">empty array []</span>
            : <span>{node.codeRefs.length} reference(s)</span>
          }
        </div>
      </div>
    </div>
  );
}

function NotesTab({
  node,
  noteContent,
  noteAuthor,
  onNoteContentChange,
  onNoteAuthorChange,
  onAddNote,
}: {
  node: NonNullable<ReturnType<typeof findNode>>;
  noteContent: string;
  noteAuthor: string;
  onNoteContentChange: (v: string) => void;
  onNoteAuthorChange: (v: string) => void;
  onAddNote: () => void;
}) {
  return (
    <div className="space-y-3" data-testid="notes-tab">
      {/* Add note form */}
      <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
        <div className="text-xs font-medium text-gray-500 uppercase">Add Note</div>
        <div>
          <label className="text-xs text-gray-500">Author</label>
          <input
            type="text"
            value={noteAuthor}
            onChange={(e) => onNoteAuthorChange(e.target.value)}
            className="w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white"
            placeholder="Author name"
            data-testid="note-author-input"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Content</label>
          <textarea
            value={noteContent}
            onChange={(e) => onNoteContentChange(e.target.value)}
            className="w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white resize-none"
            rows={3}
            placeholder="Write your note..."
            data-testid="note-content-input"
          />
        </div>
        <button
          onClick={onAddNote}
          disabled={!noteContent.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="add-note-button"
        >
          <Plus className="w-3 h-3" />
          Add Note
        </button>
      </div>

      {/* Note list */}
      <div className="space-y-2" data-testid="notes-list">
        {node.notes.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4">No notes yet</div>
        ) : (
          node.notes.map((note) => (
            <div key={note.id} className="border rounded-lg p-3 bg-white" data-testid={`note-${note.id}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700" data-testid="note-author">
                  {note.author}
                </span>
                <span className="text-xs text-gray-400" data-testid="note-timestamp">
                  {new Date(note.timestampMs).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-sm text-gray-800" data-testid="note-content">
                {note.content}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span data-testid="note-id">ID: {note.id}</span>
                <span data-testid="note-status">Status: {note.status}</span>
              </div>
              {note.tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {note.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CodeRefsTab({ node }: { node: NonNullable<ReturnType<typeof findNode>> }) {
  return (
    <div data-testid="coderefs-tab">
      {node.codeRefs.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-8">No code references</div>
      ) : (
        <div className="space-y-2">
          {node.codeRefs.map((ref, i) => (
            <div key={i} className="border rounded p-2">
              <div className="text-sm font-mono">{ref.path}</div>
              <div className="text-xs text-gray-400">{ref.role}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
