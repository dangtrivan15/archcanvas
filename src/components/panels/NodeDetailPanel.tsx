/**
 * NodeDetailPanel - shows selected node details in the right panel.
 * Tabs: Properties, Notes, Code Refs, AI Chat.
 * Used to verify node data (id, type, displayName, args, notes, codeRefs, children).
 */

import { useMemo, useState, useCallback } from 'react';
import { X, Plus, Trash2, Pencil, MessageSquare, FileCode, Settings, StickyNote, Check, XCircle, FileText, Database, Cloud, Cog, TestTube2, File, Copy, CheckCircle } from 'lucide-react';
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

  const handleAddNote = useCallback((noteTags?: string[]) => {
    if (!selectedNodeId || !noteContent.trim()) return;
    addNote({
      nodeId: selectedNodeId,
      author: noteAuthor,
      content: noteContent.trim(),
      tags: noteTags,
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
            <CodeRefsTab node={node} nodeId={selectedNodeId!} />
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

      {/* Custom Properties */}
      <CustomPropertiesSection node={node} />

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

function CustomPropertiesSection({ node }: { node: NonNullable<ReturnType<typeof findNode>> }) {
  const updateNode = useCoreStore((s) => s.updateNode);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const propertyEntries = useMemo(
    () => Object.entries(node.properties).sort(([a], [b]) => a.localeCompare(b)),
    [node.properties],
  );

  const handleAddProperty = useCallback(() => {
    if (!selectedNodeId || !newKey.trim()) return;
    const trimmedKey = newKey.trim();
    // Don't allow duplicate keys
    if (trimmedKey in node.properties) return;
    const updatedProperties = { ...node.properties, [trimmedKey]: newValue };
    updateNode(selectedNodeId, { properties: updatedProperties });
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  }, [selectedNodeId, newKey, newValue, node.properties, updateNode]);

  const handleRemoveProperty = useCallback((key: string) => {
    if (!selectedNodeId) return;
    const updatedProperties = { ...node.properties };
    delete updatedProperties[key];
    updateNode(selectedNodeId, { properties: updatedProperties });
  }, [selectedNodeId, node.properties, updateNode]);

  const handleStartEdit = useCallback((key: string) => {
    setEditingKey(key);
    setEditValue(String(node.properties[key] ?? ''));
  }, [node.properties]);

  const handleSaveEdit = useCallback(() => {
    if (!selectedNodeId || editingKey === null) return;
    const updatedProperties = { ...node.properties, [editingKey]: editValue };
    updateNode(selectedNodeId, { properties: updatedProperties });
    setEditingKey(null);
    setEditValue('');
  }, [selectedNodeId, editingKey, editValue, node.properties, updateNode]);

  const handleCancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (isAdding) {
        setIsAdding(false);
        setNewKey('');
        setNewValue('');
      }
      if (editingKey !== null) {
        handleCancelEdit();
      }
    }
  }, [isAdding, editingKey, handleCancelEdit]);

  return (
    <div data-testid="custom-properties-section">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Custom Properties ({propertyEntries.length})
        </label>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
            data-testid="add-property-button"
          >
            <Plus className="w-3 h-3" />
            Add Property
          </button>
        )}
      </div>

      {/* Add new property form */}
      {isAdding && (
        <div className="mt-2 border rounded-lg p-2 bg-blue-50/50 border-blue-200 space-y-2" data-testid="add-property-form">
          <div>
            <label className="text-xs text-gray-500">Key</label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleAddProperty)}
              placeholder="Property name (e.g., environment)"
              className="w-full mt-0.5 text-xs border rounded px-2 py-1 bg-white border-gray-200 focus:border-blue-400 focus:outline-none"
              autoFocus
              data-testid="new-property-key-input"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Value</label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleAddProperty)}
              placeholder="Property value (e.g., production)"
              className="w-full mt-0.5 text-xs border rounded px-2 py-1 bg-white border-gray-200 focus:border-blue-400 focus:outline-none"
              data-testid="new-property-value-input"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddProperty}
              disabled={!newKey.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="confirm-add-property"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewKey(''); setNewValue(''); }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
              data-testid="cancel-add-property"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Property list */}
      <div className="mt-2 space-y-1" data-testid="properties-list">
        {propertyEntries.length === 0 && !isAdding && (
          <div className="text-xs text-gray-400 text-center py-3" data-testid="properties-empty-state">
            No custom properties. Click "Add Property" to create one.
          </div>
        )}
        {propertyEntries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center gap-2 bg-gray-50 rounded p-2 border border-gray-100 group"
            data-testid={`property-${key}`}
          >
            <span className="text-xs font-medium text-gray-700 shrink-0" data-testid="property-key">
              {key}
            </span>
            <span className="text-gray-300">=</span>
            {editingKey === key ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                onBlur={handleSaveEdit}
                className="flex-1 min-w-0 text-xs border rounded px-1.5 py-0.5 bg-white border-blue-300 focus:outline-none"
                autoFocus
                data-testid="property-value-edit"
              />
            ) : (
              <span
                className="flex-1 min-w-0 text-xs text-gray-600 font-mono truncate cursor-pointer hover:text-blue-600"
                onClick={() => handleStartEdit(key)}
                title="Click to edit"
                data-testid="property-value"
              >
                {String(value) || <span className="text-gray-400 italic">empty</span>}
              </span>
            )}
            <button
              onClick={() => handleStartEdit(key)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-500 rounded transition-opacity"
              title="Edit property"
              data-testid={`edit-property-${key}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleRemoveProperty(key)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 rounded transition-opacity"
              title="Remove property"
              data-testid={`remove-property-${key}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Color palette for tag badges - cycles through these colors */
const TAG_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
];

function getTagColor(tag: string) {
  // Deterministic color based on tag string hash
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash) + tag.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
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
  onAddNote: (tags?: string[]) => void;
}) {
  const resolveSuggestion = useCoreStore((s) => s.resolveSuggestion);
  const removeNote = useCoreStore((s) => s.removeNote);
  const [isEditing, setIsEditing] = useState(false);
  const [contentError, setContentError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Sort notes chronologically (oldest first) by timestamp
  const sortedNotes = useMemo(
    () => [...node.notes].sort((a, b) => a.timestampMs - b.timestampMs),
    [node.notes],
  );

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }, [tagInput, tags, handleAddTag]);

  const handleSave = useCallback(() => {
    if (!noteContent.trim()) {
      setContentError('Note content cannot be empty');
      return;
    }
    setContentError('');
    onAddNote(tags.length > 0 ? tags : undefined);
    setIsEditing(false);
    setTags([]);
    setTagInput('');
  }, [noteContent, onAddNote, tags]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    onNoteContentChange('');
    setContentError('');
    setTags([]);
    setTagInput('');
  }, [onNoteContentChange]);

  const handleOpenEditor = useCallback(() => {
    setIsEditing(true);
    setContentError('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleCancel]);

  return (
    <div className="space-y-3" data-testid="notes-tab">
      {/* Add Note button / inline editor */}
      {!isEditing ? (
        <button
          onClick={handleOpenEditor}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          data-testid="add-note-button"
        >
          <Plus className="w-3 h-3" />
          Add Note
        </button>
      ) : (
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50" data-testid="note-editor">
          <div className="text-xs font-medium text-gray-500 uppercase">New Note</div>
          <div>
            <label className="text-xs text-gray-500">Author</label>
            <input
              type="text"
              value={noteAuthor}
              onChange={(e) => onNoteAuthorChange(e.target.value)}
              className="w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white border-gray-200 focus:border-blue-400 focus:outline-none"
              placeholder="Author name"
              data-testid="note-author-input"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Content</label>
            <textarea
              value={noteContent}
              onChange={(e) => { onNoteContentChange(e.target.value); if (contentError) setContentError(''); }}
              onKeyDown={handleKeyDown}
              className={`w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white resize-none focus:outline-none ${contentError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
              rows={3}
              placeholder="Write your note (markdown supported)..."
              autoFocus
              data-testid="note-content-input"
            />
            {contentError && (
              <div className="text-xs text-red-500 mt-0.5" data-testid="note-content-error">{contentError}</div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500">Tags</label>
            <div className="flex flex-wrap items-center gap-1 mt-0.5 p-1 border rounded bg-white border-gray-200 min-h-[30px]">
              {tags.map((tag) => {
                const color = getTagColor(tag);
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}
                    data-testid={`editor-tag-${tag}`}
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 hover:opacity-70"
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
                placeholder={tags.length === 0 ? "Type tag and press Enter..." : ""}
                className="flex-1 min-w-[80px] text-xs border-none outline-none bg-transparent px-1 py-0.5"
                data-testid="note-tags-input"
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Press Enter or comma to add tags</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              data-testid="save-note-button"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
              data-testid="cancel-note-button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Note list - chronologically sorted (oldest first) */}
      <div className="space-y-2" data-testid="notes-list">
        {sortedNotes.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4" data-testid="notes-empty-state">No notes yet</div>
        ) : (
          sortedNotes.map((note) => (
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
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span data-testid="note-id">ID: {note.id}</span>
                  <span data-testid="note-status">Status: {note.status}</span>
                </div>
                <button
                  onClick={() => removeNote(nodeId, note.id)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                  title="Delete note"
                  data-testid={`delete-note-${note.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2" data-testid="note-tags">
                  {note.tags.map((tag) => {
                    const color = getTagColor(tag);
                    return (
                      <span
                        key={tag}
                        className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}
                        data-testid={`tag-badge-${tag}`}
                      >
                        {tag}
                      </span>
                    );
                  })}
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

function CodeRefsTab({ node, nodeId }: { node: NonNullable<ReturnType<typeof findNode>>; nodeId: string }) {
  const addCodeRef = useCoreStore((s) => s.addCodeRef);
  const [isAdding, setIsAdding] = useState(false);
  const [path, setPath] = useState('');
  const [role, setRole] = useState<'source' | 'api-spec' | 'schema' | 'deployment' | 'config' | 'test'>('source');
  const [pathError, setPathError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyPath = useCallback(async (refPath: string, index: number) => {
    try {
      await navigator.clipboard.writeText(refPath);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = refPath;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  const roleOptions: { value: typeof role; label: string }[] = [
    { value: 'source', label: 'Source' },
    { value: 'api-spec', label: 'API Spec' },
    { value: 'schema', label: 'Schema' },
    { value: 'deployment', label: 'Deployment' },
    { value: 'config', label: 'Config' },
    { value: 'test', label: 'Test' },
  ];

  const getRoleIcon = (refRole: string) => {
    switch (refRole) {
      case 'source': return <FileCode className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'api-spec': return <FileText className="w-4 h-4 text-green-500 shrink-0" />;
      case 'schema': return <Database className="w-4 h-4 text-purple-500 shrink-0" />;
      case 'deployment': return <Cloud className="w-4 h-4 text-orange-500 shrink-0" />;
      case 'config': return <Cog className="w-4 h-4 text-gray-500 shrink-0" />;
      case 'test': return <TestTube2 className="w-4 h-4 text-yellow-500 shrink-0" />;
      default: return <File className="w-4 h-4 text-gray-400 shrink-0" />;
    }
  };

  const handleSubmit = useCallback(() => {
    if (!path.trim()) {
      setPathError('Path is required');
      return;
    }
    setPathError('');
    addCodeRef({ nodeId, path: path.trim(), role });
    setPath('');
    setRole('source');
    setIsAdding(false);
  }, [nodeId, path, role, addCodeRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsAdding(false);
      setPath('');
      setRole('source');
      setPathError('');
    }
  }, [handleSubmit]);

  return (
    <div className="space-y-3" data-testid="coderefs-tab">
      {/* Add Code Reference button / form */}
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          data-testid="add-coderef-button"
        >
          <Plus className="w-3 h-3" />
          Add Code Reference
        </button>
      ) : (
        <div className="border rounded-lg p-3 bg-gray-50 space-y-2" data-testid="add-coderef-form">
          <div className="text-xs font-medium text-gray-500 uppercase">Add Code Reference</div>
          <div>
            <label className="text-xs text-gray-500">File Path</label>
            <input
              type="text"
              value={path}
              onChange={(e) => { setPath(e.target.value); if (pathError) setPathError(''); }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., src/api/handler.ts"
              className={`w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white focus:outline-none ${pathError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
              autoFocus
              data-testid="coderef-path-input"
            />
            {pathError && (
              <div className="text-xs text-red-500 mt-0.5" data-testid="coderef-path-error">{pathError}</div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white border-gray-200 focus:border-blue-400 focus:outline-none"
              data-testid="coderef-role-select"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              data-testid="submit-coderef-button"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
            <button
              onClick={() => { setIsAdding(false); setPath(''); setRole('source'); setPathError(''); }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
              data-testid="cancel-coderef-button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Code References list */}
      <div data-testid="coderefs-list">
        {node.codeRefs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-4" data-testid="coderefs-empty-state">No code references</div>
        ) : (
          <div className="space-y-2">
            {node.codeRefs.map((ref, i) => (
              <div
                key={i}
                className="border rounded p-2 bg-white flex items-start gap-2 cursor-pointer hover:bg-gray-50 transition-colors group relative"
                data-testid={`coderef-${i}`}
                onClick={() => handleCopyPath(ref.path, i)}
                title="Click to copy path"
              >
                <div className="mt-0.5" data-testid="coderef-icon">{getRoleIcon(ref.role)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono truncate" data-testid="coderef-path">{ref.path}</div>
                  <div className="text-xs text-gray-400" data-testid="coderef-role">{ref.role}</div>
                </div>
                <div className="mt-0.5 shrink-0" data-testid={`coderef-copy-${i}`}>
                  {copiedIndex === i ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                  )}
                </div>
                {copiedIndex === i && (
                  <div className="absolute right-2 top-0 -translate-y-full bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg" data-testid="copy-feedback">
                    Copied!
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
