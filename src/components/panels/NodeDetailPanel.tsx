/**
 * NodeDetailPanel - shows selected node details in the right panel.
 * Tabs: Properties, Notes, Code Refs, AI Chat.
 * Used to verify node data (id, type, displayName, args, notes, codeRefs, children).
 */

import { useMemo, useState, useCallback } from 'react';
import { X, Plus, MessageSquare, FileCode, Settings, StickyNote, Check, XCircle } from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { findNode } from '@/core/graph/graphEngine';
import { AIChatTab } from './AIChatTab';
import type { NodeDef, ArgDef } from '@/types/nodedef';

type Tab = 'properties' | 'notes' | 'coderefs' | 'aichat';

export function NodeDetailPanel() {
  const graph = useCoreStore((s) => s.graph);
  const addNote = useCoreStore((s) => s.addNote);
  const registry = useCoreStore((s) => s.registry);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  const [activeTab, setActiveTab] = useState<Tab>('properties');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('developer');

  const node = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNode(graph, selectedNodeId);
  }, [graph, selectedNodeId]);

  const nodeDef = useMemo(() => {
    if (!node || !registry) return undefined;
    return registry.resolve(node.type);
  }, [node, registry]);

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
      {activeTab === 'aichat' ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <AIChatTab />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'properties' && (
            <PropertiesTab node={node} nodeDef={nodeDef} />
          )}
          {activeTab === 'notes' && (
            <NotesTab
              node={node}
              nodeId={selectedNodeId!}
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
        </div>
      )}
    </div>
  );
}

function PropertiesTab({ node, nodeDef }: { node: NonNullable<ReturnType<typeof findNode>>; nodeDef?: NodeDef }) {
  const updateNode = useCoreStore((s) => s.updateNode);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleArgChange = useCallback((argName: string, value: string | number | boolean) => {
    if (!selectedNodeId) return;
    const updatedArgs = { ...node.args, [argName]: value };
    // Remove empty string values (treated as "cleared")
    if (value === '') {
      delete updatedArgs[argName];
    }
    updateNode(selectedNodeId, { args: updatedArgs });
    setTouched((prev) => ({ ...prev, [argName]: true }));
  }, [selectedNodeId, node.args, updateNode]);

  const handleArgBlur = useCallback((argName: string) => {
    setTouched((prev) => ({ ...prev, [argName]: true }));
  }, []);

  const getValidationError = useCallback((argDef: ArgDef): string | null => {
    if (!argDef.required) return null;
    const value = node.args[argDef.name];
    if (value === undefined || value === null || value === '') {
      return `${argDef.name} is required`;
    }
    return null;
  }, [node.args]);

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

      {/* NodeDef Args - editable display from nodedef schema */}
      {nodeDef && nodeDef.spec.args.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Arguments ({nodeDef.spec.args.length})
          </label>
          <div className="mt-1 space-y-2" data-testid="nodedef-args">
            {nodeDef.spec.args.map((argDef: ArgDef) => {
              const currentValue = node.args[argDef.name];
              const isRequired = argDef.required === true;
              const validationError = getValidationError(argDef);
              const isTouched = touched[argDef.name];
              // Show error immediately if required and empty, or after touch
              const showError = isRequired && validationError !== null && (isTouched || (currentValue === undefined || currentValue === null || currentValue === ''));

              return (
                <div
                  key={argDef.name}
                  className={`bg-gray-50 rounded p-2 border ${showError ? 'border-red-300 bg-red-50/30' : 'border-gray-100'}`}
                  data-testid={`nodedef-arg-${argDef.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 flex items-center gap-1" data-testid="arg-name">
                      {argDef.name}
                      {isRequired && (
                        <span className="text-red-500" data-testid="required-indicator" title="Required">*</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {isRequired && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-600 font-medium" data-testid="required-badge">
                          Required
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-mono" data-testid="arg-type">{argDef.type}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5" data-testid="arg-description">{argDef.description}</div>

                  {/* Editable form control */}
                  <div className="mt-1.5">
                    {argDef.type === 'enum' && argDef.options ? (
                      <select
                        value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                        onChange={(e) => handleArgChange(argDef.name, e.target.value)}
                        onBlur={() => handleArgBlur(argDef.name)}
                        className={`w-full text-xs border rounded px-2 py-1 bg-white ${showError ? 'border-red-400' : 'border-gray-200'}`}
                        data-testid={`arg-input-${argDef.name}`}
                      >
                        <option value="">— Select —</option>
                        {argDef.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : argDef.type === 'number' ? (
                      <input
                        type="number"
                        value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleArgChange(argDef.name, val === '' ? '' as unknown as number : Number(val));
                        }}
                        onBlur={() => handleArgBlur(argDef.name)}
                        placeholder={argDef.default !== undefined ? `Default: ${argDef.default}` : ''}
                        className={`w-full text-xs border rounded px-2 py-1 bg-white ${showError ? 'border-red-400' : 'border-gray-200'}`}
                        data-testid={`arg-input-${argDef.name}`}
                      />
                    ) : argDef.type === 'boolean' ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={currentValue === true || currentValue === 'true'}
                          onChange={(e) => handleArgChange(argDef.name, e.target.checked)}
                          onBlur={() => handleArgBlur(argDef.name)}
                          data-testid={`arg-input-${argDef.name}`}
                        />
                        <span className="text-gray-600">{currentValue === true || currentValue === 'true' ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
                        onChange={(e) => handleArgChange(argDef.name, e.target.value)}
                        onBlur={() => handleArgBlur(argDef.name)}
                        placeholder={argDef.default !== undefined ? `Default: ${argDef.default}` : ''}
                        className={`w-full text-xs border rounded px-2 py-1 bg-white ${showError ? 'border-red-400' : 'border-gray-200'}`}
                        data-testid={`arg-input-${argDef.name}`}
                      />
                    )}
                  </div>

                  {/* Validation error */}
                  {showError && (
                    <div className="mt-1 text-[11px] text-red-600 flex items-center gap-1" data-testid={`arg-error-${argDef.name}`}>
                      <span>⚠</span> {validationError}
                    </div>
                  )}

                  {argDef.default !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">Default:</span>
                      <span className="text-[10px] font-mono text-gray-500" data-testid="arg-default">{String(argDef.default)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback: Raw args when nodedef is not available */}
      {!nodeDef && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Arguments</label>
          <div className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded" data-testid="detail-args">
            {Object.keys(node.args).length === 0
              ? <span className="text-gray-400">empty object {'{}'}</span>
              : JSON.stringify(node.args, null, 2)
            }
          </div>
        </div>
      )}

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
  nodeId,
  noteContent,
  noteAuthor,
  onNoteContentChange,
  onNoteAuthorChange,
  onAddNote,
}: {
  node: NonNullable<ReturnType<typeof findNode>>;
  nodeId: string;
  noteContent: string;
  noteAuthor: string;
  onNoteContentChange: (v: string) => void;
  onNoteAuthorChange: (v: string) => void;
  onAddNote: () => void;
}) {
  const resolveSuggestion = useCoreStore((s) => s.resolveSuggestion);

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
          <div className="text-sm text-gray-400 text-center py-4" data-testid="notes-empty-state">No notes yet</div>
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
              {/* Accept/Dismiss buttons for pending AI suggestions */}
              {note.status === 'pending' && (
                <div className="flex gap-2 mt-2" data-testid="suggestion-actions">
                  <button
                    onClick={() => resolveSuggestion(nodeId, note.id, 'accepted')}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                    data-testid="accept-suggestion"
                  >
                    <Check className="w-3 h-3" />
                    Accept
                  </button>
                  <button
                    onClick={() => resolveSuggestion(nodeId, note.id, 'dismissed')}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    data-testid="dismiss-suggestion"
                  >
                    <XCircle className="w-3 h-3" />
                    Dismiss
                  </button>
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
