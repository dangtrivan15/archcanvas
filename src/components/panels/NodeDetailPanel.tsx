/**
 * NodeDetailPanel - shows selected node details in the right panel.
 * Tabs: Properties, Notes, Code Refs, Terminal.
 * Used to verify node data (id, type, displayName, args, notes, codeRefs, children).
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  FileCode,
  Settings,
  StickyNote,
  Check,
  FileText,
  Database,
  Cloud,
  Cog,
  TestTube2,
  File,
  Copy,
  CheckCircle,
  Bot,
  Palette,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useUIStore } from '@/store/uiStore';
import { findNode } from '@/core/graph/graphEngine';
import { TerminalPanel } from './TerminalPanel';
import type { NodeDef, ArgDef } from '@/types/nodedef';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { marked } from 'marked';
import { sanitizeHtml } from '@/utils/sanitizeHtml';
import { NODE_COLOR_PALETTE, getDefaultNodeColor, getEffectiveNodeColor } from '@/utils/nodeColors';
import { usePropertyKeyboardNav } from '@/hooks/usePropertyKeyboardNav';
import { getClipboardAdapter } from '@/core/platform/clipboardAdapter';

// Configure marked for inline rendering (no wrapping <p> tags for short content)
const markedInline = new marked.Renderer();

/** Render markdown content to sanitized HTML (XSS-safe) */
function renderMarkdown(content: string): string {
  // Use marked.parse for full markdown, parseInline for single-line content
  const hasBlockElements = /\n\n|^#{1,6}\s|^[-*]\s|^\d+\.\s|^>/m.test(content);
  let html: string;
  if (hasBlockElements) {
    html = marked.parse(content, { async: false, renderer: markedInline }) as string;
  } else {
    html = marked.parseInline(content, { async: false }) as string;
  }
  // Sanitize HTML to prevent XSS attacks
  return sanitizeHtml(html);
}

type Tab = 'properties' | 'notes' | 'coderefs' | 'terminal';

export function NodeDetailPanel() {
  const graph = useCoreStore((s) => s.graph);
  const addNote = useCoreStore((s) => s.addNote);
  const registry = useCoreStore((s) => s.registry);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const pendingRenameNodeId = useUIStore((s) => s.pendingRenameNodeId);

  const rightPanelTab = useUIStore((s) => s.rightPanelTab);
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);

  const [activeTab, setActiveTabLocal] = useState<Tab>('properties');
  const [noteContent, setNoteContent] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('developer');

  // Sync local activeTab with uiStore's rightPanelTab when it changes externally
  useEffect(() => {
    if (rightPanelTab && rightPanelTab !== activeTab) {
      setActiveTabLocal(rightPanelTab as Tab);
    }
  }, [rightPanelTab]);

  // Wrapper to sync both local state and uiStore when user clicks a tab
  const setActiveTab = useCallback(
    (tab: Tab) => {
      setActiveTabLocal(tab);
      setRightPanelTab(tab);
    },
    [setRightPanelTab],
  );

  const node = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNode(graph, selectedNodeId);
  }, [graph, selectedNodeId]);

  const nodeDef = useMemo(() => {
    if (!node || !registry) return undefined;
    return registry.resolve(node.type);
  }, [node, registry]);

  const handleAddNote = useCallback(
    (noteTags?: string[]) => {
      if (!selectedNodeId || !noteContent.trim()) return;
      addNote({
        nodeId: selectedNodeId,
        author: noteAuthor,
        content: noteContent.trim(),
        tags: noteTags,
      });
      setNoteContent('');
    },
    [selectedNodeId, noteContent, noteAuthor, addNote],
  );

  // Auto-switch to properties tab when rename mode is triggered
  useEffect(() => {
    if (pendingRenameNodeId && selectedNodeId && pendingRenameNodeId === selectedNodeId) {
      setActiveTab('properties');
    }
  }, [pendingRenameNodeId, selectedNodeId]);

  // If no node selected but terminal tab requested, show terminal only
  if (!node && activeTab === 'terminal') {
    return (
      <div className="h-full flex flex-col" data-testid="node-detail-panel">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-surface">
          <div className="text-sm font-medium text-text">Terminal</div>
          <button
            onClick={closeRightPanel}
            className="p-1 rounded hover:bg-highlight-low text-muted-foreground touch-target"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <TerminalPanel />
      </div>
    );
  }

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
          className="p-1 rounded hover:bg-gray-200 text-gray-400 touch-target"
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
          { key: 'terminal' as Tab, icon: Terminal, label: 'Terminal' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors touch-target-row
              ${
                activeTab === key
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
      {activeTab === 'terminal' ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <TerminalPanel />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'properties' && <PropertiesTab node={node} nodeDef={nodeDef} />}
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
          {activeTab === 'coderefs' && <CodeRefsTab node={node} nodeId={selectedNodeId!} />}
        </div>
      )}
    </div>
  );
}

function PropertiesTab({
  node,
  nodeDef,
}: {
  node: NonNullable<ReturnType<typeof findNode>>;
  nodeDef?: NodeDef;
}) {
  const updateNode = useCoreStore((s) => s.updateNode);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const pendingRenameNodeId = useUIStore((s) => s.pendingRenameNodeId);
  const clearPendingRename = useUIStore((s) => s.clearPendingRename);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Track raw text input for number fields so we can validate non-numeric text
  const [numberInputValues, setNumberInputValues] = useState<Record<string, string>>({});
  // Rename mode state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const displayNameInputRef = useRef<HTMLInputElement>(null);
  const propertiesContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation for Edit mode (Tab/Shift+Tab cycle, Enter→next, Escape→exit)
  usePropertyKeyboardNav(propertiesContainerRef);

  // Handle rename save
  const handleRenameSave = useCallback(() => {
    if (!selectedNodeId || !editingNameValue.trim()) {
      setIsEditingName(false);
      return;
    }
    updateNode(selectedNodeId, { displayName: editingNameValue.trim() });
    setIsEditingName(false);
  }, [selectedNodeId, editingNameValue, updateNode]);

  // Handle rename cancel
  const handleRenameCancel = useCallback(() => {
    setIsEditingName(false);
    setEditingNameValue('');
  }, []);

  // Auto-trigger rename mode when pendingRenameNodeId matches current node
  useEffect(() => {
    if (pendingRenameNodeId && selectedNodeId && pendingRenameNodeId === selectedNodeId) {
      setIsEditingName(true);
      setEditingNameValue(node.displayName);
      clearPendingRename();
      // Focus the input after render
      requestAnimationFrame(() => {
        displayNameInputRef.current?.focus();
        displayNameInputRef.current?.select();
      });
    }
  }, [pendingRenameNodeId, selectedNodeId, node.displayName, clearPendingRename]);

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditingName) {
      requestAnimationFrame(() => {
        displayNameInputRef.current?.focus();
        displayNameInputRef.current?.select();
      });
    }
  }, [isEditingName]);

  const handleArgChange = useCallback(
    (argName: string, value: string | number | boolean | string[]) => {
      if (!selectedNodeId) return;
      const updatedArgs = { ...node.args, [argName]: value };
      // Remove empty string values (treated as "cleared")
      if (value === '') {
        delete updatedArgs[argName];
      }
      updateNode(selectedNodeId, { args: updatedArgs });
      setTouched((prev) => ({ ...prev, [argName]: true }));
    },
    [selectedNodeId, node.args, updateNode],
  );

  const handleNumberInputChange = useCallback(
    (argName: string, rawValue: string) => {
      setNumberInputValues((prev) => ({ ...prev, [argName]: rawValue }));
      setTouched((prev) => ({ ...prev, [argName]: true }));
      if (!selectedNodeId) return;
      // Only update the actual arg value if the input is a valid number or empty
      if (rawValue === '' || rawValue === '-') {
        const updatedArgs = { ...node.args };
        delete updatedArgs[argName];
        updateNode(selectedNodeId, { args: updatedArgs });
      } else {
        const num = Number(rawValue);
        if (!isNaN(num) && rawValue.trim() !== '') {
          const updatedArgs = { ...node.args, [argName]: num };
          updateNode(selectedNodeId, { args: updatedArgs });
        }
      }
    },
    [selectedNodeId, node.args, updateNode],
  );

  const handleArgBlur = useCallback((argName: string) => {
    setTouched((prev) => ({ ...prev, [argName]: true }));
  }, []);

  const getValidationError = useCallback(
    (argDef: ArgDef): string | null => {
      // Number field validation: check for non-numeric text
      if (argDef.type === 'number') {
        const rawValue = numberInputValues[argDef.name];
        if (rawValue !== undefined && rawValue !== '' && rawValue !== '-') {
          const num = Number(rawValue);
          if (isNaN(num)) {
            return `${argDef.name} must be a valid number`;
          }
        }
      }
      // Required field validation
      if (!argDef.required) return null;
      const value = node.args[argDef.name];
      if (value === undefined || value === null || value === '') {
        return `${argDef.name} is required`;
      }
      return null;
    },
    [node.args, numberInputValues],
  );

  return (
    <div className="space-y-4" data-testid="properties-tab" ref={propertiesContainerRef}>
      {/* Node ID */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">ID</label>
        <div
          className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded break-all"
          data-testid="detail-node-id"
        >
          {node.id}
        </div>
      </div>

      {/* Display Name (editable) */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Display Name
          </label>
          {!isEditingName && (
            <button
              onClick={() => {
                setIsEditingName(true);
                setEditingNameValue(node.displayName);
              }}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 touch-target"
              title="Rename node"
              data-testid="rename-node-button"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        {isEditingName ? (
          <div className="mt-1 flex items-center gap-1">
            <input
              ref={displayNameInputRef}
              type="text"
              value={editingNameValue || node.displayName}
              onChange={(e) => setEditingNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRenameSave();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRenameCancel();
                }
              }}
              onBlur={() => {
                handleRenameSave();
              }}
              className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              data-testid="detail-display-name-input"
              data-edit-field="display-name"
              aria-label="Node display name"
            />
          </div>
        ) : (
          <div
            className="mt-1 text-sm cursor-pointer hover:text-blue-600"
            data-testid="detail-display-name"
            onClick={() => {
              setIsEditingName(true);
              setEditingNameValue(node.displayName);
            }}
            title="Click to rename"
          >
            {node.displayName}
          </div>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</label>
        <div className="mt-1 text-sm font-mono" data-testid="detail-type">
          {node.type}
        </div>
      </div>

      {/* Node Color Picker */}
      <NodeColorPicker node={node} />

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
              // Show error for: required field empty, or number field with invalid input
              const isNumberError =
                argDef.type === 'number' && validationError !== null && isTouched;
              const showError =
                isNumberError ||
                (isRequired &&
                  validationError !== null &&
                  (isTouched ||
                    currentValue === undefined ||
                    currentValue === null ||
                    currentValue === ''));

              return (
                <div
                  key={argDef.name}
                  className={`bg-gray-50 rounded p-2 border ${showError ? 'border-red-300 bg-red-50/30' : 'border-gray-100'}`}
                  data-testid={`nodedef-arg-${argDef.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-medium text-gray-700 flex items-center gap-1"
                      data-testid="arg-name"
                    >
                      {argDef.name}
                      {isRequired && (
                        <span
                          className="text-red-500"
                          data-testid="required-indicator"
                          title="Required"
                        >
                          *
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {isRequired && (
                        <span
                          className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-600 font-medium"
                          data-testid="required-badge"
                        >
                          Required
                        </span>
                      )}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-mono"
                        data-testid="arg-type"
                      >
                        {argDef.type}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5" data-testid="arg-description">
                    {argDef.description}
                  </div>

                  {/* Editable form control */}
                  <div className="mt-1.5">
                    {argDef.type === 'enum' && argDef.options ? (
                      <select
                        value={
                          currentValue !== undefined && currentValue !== null
                            ? String(currentValue)
                            : ''
                        }
                        onChange={(e) => handleArgChange(argDef.name, e.target.value)}
                        onBlur={() => handleArgBlur(argDef.name)}
                        aria-label={argDef.name}
                        className={`w-full text-xs border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${showError ? 'border-red-400' : 'border-gray-200'}`}
                        data-testid={`arg-input-${argDef.name}`}
                        data-edit-field={`arg-${argDef.name}`}
                      >
                        <option value="">— Select —</option>
                        {argDef.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : argDef.type === 'number' ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          numberInputValues[argDef.name] !== undefined
                            ? numberInputValues[argDef.name]
                            : currentValue !== undefined && currentValue !== null
                              ? String(currentValue)
                              : ''
                        }
                        onChange={(e) => handleNumberInputChange(argDef.name, e.target.value)}
                        onBlur={() => handleArgBlur(argDef.name)}
                        placeholder={
                          argDef.default !== undefined ? `Default: ${argDef.default}` : ''
                        }
                        aria-label={argDef.name}
                        className={`w-full text-xs border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${showError ? 'border-red-400' : 'border-gray-200'}`}
                        data-testid={`arg-input-${argDef.name}`}
                        data-edit-field={`arg-${argDef.name}`}
                      />
                    ) : argDef.type === 'boolean' ? (
                      (() => {
                        const isChecked = currentValue === true || currentValue === 'true';
                        return (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isChecked}
                              aria-label={argDef.name}
                              onClick={() => handleArgChange(argDef.name, !isChecked)}
                              onBlur={() => handleArgBlur(argDef.name)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${isChecked ? 'bg-blue-600' : 'bg-gray-300'}`}
                              data-testid={`arg-input-${argDef.name}`}
                              data-edit-field={`arg-${argDef.name}`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${isChecked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
                              />
                            </button>
                            <span
                              className="text-xs text-gray-600"
                              data-testid={`arg-toggle-label-${argDef.name}`}
                            >
                              {isChecked ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <input
                        type="text"
                        value={
                          currentValue !== undefined && currentValue !== null
                            ? String(currentValue)
                            : ''
                        }
                        onChange={(e) => handleArgChange(argDef.name, e.target.value)}
                        onBlur={() => handleArgBlur(argDef.name)}
                        placeholder={
                          argDef.default !== undefined ? `Default: ${argDef.default}` : ''
                        }
                        aria-label={argDef.name}
                        className={`w-full text-xs border rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${showError ? 'border-red-400' : 'border-gray-200'}`}
                        data-testid={`arg-input-${argDef.name}`}
                        data-edit-field={`arg-${argDef.name}`}
                      />
                    )}
                  </div>

                  {/* Validation error */}
                  {showError && (
                    <div
                      className="mt-1 text-[11px] text-red-600 flex items-center gap-1"
                      data-testid={`arg-error-${argDef.name}`}
                    >
                      <span>⚠</span> {validationError}
                    </div>
                  )}

                  {argDef.default !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">Default:</span>
                      <span
                        className="text-[10px] font-mono text-gray-500"
                        data-testid="arg-default"
                      >
                        {String(argDef.default)}
                      </span>
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
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Arguments
          </label>
          <div
            className="mt-1 text-xs font-mono bg-gray-50 px-2 py-1 rounded"
            data-testid="detail-args"
          >
            {Object.keys(node.args).length === 0 ? (
              <span className="text-gray-400">empty object {'{}'}</span>
            ) : (
              JSON.stringify(node.args, null, 2)
            )}
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
          {node.children.length === 0 ? (
            <span className="text-gray-400">empty array []</span>
          ) : (
            node.children.map((child) => (
              <div key={child.id} className="bg-gray-50 px-2 py-1 rounded mt-1">
                {child.displayName} ({child.type})
              </div>
            ))
          )}
        </div>
      </div>

      {/* Notes count */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Notes ({node.notes.length})
        </label>
        <div className="mt-1 text-xs" data-testid="detail-notes-count">
          {node.notes.length === 0 ? (
            <span className="text-gray-400">empty array []</span>
          ) : (
            <span>{node.notes.length} note(s)</span>
          )}
        </div>
      </div>

      {/* Code Refs count */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Code References ({node.codeRefs.length})
        </label>
        <div className="mt-1 text-xs" data-testid="detail-coderefs-count">
          {node.codeRefs.length === 0 ? (
            <span className="text-gray-400">empty array []</span>
          ) : (
            <span>{node.codeRefs.length} reference(s)</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * NodeColorPicker - allows users to pick a custom color for a node.
 * Shows current effective color (custom or type-default) and a palette of predefined colors.
 * Includes a "Reset to default" button to clear custom color.
 */
function NodeColorPicker({ node }: { node: NonNullable<ReturnType<typeof findNode>> }) {
  const updateNodeColor = useCoreStore((s) => s.updateNodeColor);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const [isOpen, setIsOpen] = useState(false);

  const customColor = node.position.color;
  const defaultColor = getDefaultNodeColor(node.type);
  const effectiveColor = getEffectiveNodeColor(customColor, node.type);
  const hasCustomColor = !!customColor && customColor.trim() !== '';

  const handleColorSelect = useCallback(
    (color: string) => {
      if (!selectedNodeId) return;
      updateNodeColor(selectedNodeId, color);
    },
    [selectedNodeId, updateNodeColor],
  );

  const handleResetColor = useCallback(() => {
    if (!selectedNodeId) return;
    updateNodeColor(selectedNodeId, undefined);
  }, [selectedNodeId, updateNodeColor]);

  return (
    <div data-testid="node-color-picker">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
        <Palette className="w-3 h-3" />
        Color
      </label>
      <div className="mt-1">
        <div className="flex items-center gap-2">
          {/* Current color swatch + toggle button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-2 py-1 text-xs border border-gray-200 rounded hover:border-gray-300 bg-white"
            data-testid="color-picker-toggle"
            aria-label="Pick node color"
          >
            <span
              className="w-4 h-4 rounded border border-gray-300"
              style={{ backgroundColor: effectiveColor }}
              data-testid="current-color-swatch"
            />
            <span className="font-mono text-gray-600">{effectiveColor}</span>
            {hasCustomColor && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">
                custom
              </span>
            )}
          </button>

          {/* Reset to default button */}
          {hasCustomColor && (
            <button
              type="button"
              onClick={handleResetColor}
              className="flex items-center gap-1 px-1.5 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:border-gray-300"
              data-testid="color-reset-button"
              title="Reset to default type color"
              aria-label="Reset to default color"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Color palette (expandable) */}
        {isOpen && (
          <div
            className="mt-2 p-2 bg-gray-50 rounded border border-gray-200"
            data-testid="color-palette"
          >
            <div className="text-[10px] text-gray-500 mb-1.5">
              Type default: <span className="font-mono">{defaultColor}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {NODE_COLOR_PALETTE.map((paletteColor) => (
                <button
                  key={paletteColor.value}
                  type="button"
                  onClick={() => handleColorSelect(paletteColor.value)}
                  className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                    effectiveColor === paletteColor.value
                      ? 'border-gray-800 ring-1 ring-gray-400'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: paletteColor.value }}
                  title={paletteColor.name}
                  aria-label={`Set color to ${paletteColor.name}`}
                  data-testid={`color-option-${paletteColor.name.toLowerCase()}`}
                />
              ))}
            </div>
          </div>
        )}
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

  const handleRemoveProperty = useCallback(
    (key: string) => {
      if (!selectedNodeId) return;
      const updatedProperties = { ...node.properties };
      delete updatedProperties[key];
      updateNode(selectedNodeId, { properties: updatedProperties });
    },
    [selectedNodeId, node.properties, updateNode],
  );

  const handleStartEdit = useCallback(
    (key: string) => {
      setEditingKey(key);
      setEditValue(String(node.properties[key] ?? ''));
    },
    [node.properties],
  );

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, action: () => void) => {
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
    },
    [isAdding, editingKey, handleCancelEdit],
  );

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
        <div
          className="mt-2 border rounded-lg p-2 bg-blue-50/50 border-blue-200 space-y-2"
          data-testid="add-property-form"
        >
          <div>
            <label htmlFor="new-property-key" className="text-xs text-gray-500">
              Key
            </label>
            <input
              id="new-property-key"
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
            <label htmlFor="new-property-value" className="text-xs text-gray-500">
              Value
            </label>
            <input
              id="new-property-value"
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
              onClick={() => {
                setIsAdding(false);
                setNewKey('');
                setNewValue('');
              }}
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
          <div
            className="text-xs text-gray-400 text-center py-3"
            data-testid="properties-empty-state"
          >
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
                aria-label={`Edit value for property ${key}`}
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
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-500 rounded transition-opacity touch-target"
              title="Edit property"
              data-testid={`edit-property-${key}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleRemoveProperty(key)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 rounded transition-opacity touch-target"
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
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]!;
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
  const removeNote = useCoreStore((s) => s.removeNote);
  const updateNote = useCoreStore((s) => s.updateNote);
  const [isEditing, setIsEditing] = useState(false);
  const [contentError, setContentError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  // Guard against double-click creating duplicate notes
  const savingNoteRef = useRef(false);
  // Edit existing note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Auto-update relative timestamps every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

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

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [tagInput, tags, handleAddTag],
  );

  const handleSave = useCallback(() => {
    // Guard against double-click creating duplicate notes
    if (savingNoteRef.current) return;
    if (!noteContent.trim()) {
      setContentError('Note content cannot be empty');
      return;
    }
    savingNoteRef.current = true;
    setContentError('');
    onAddNote(tags.length > 0 ? tags : undefined);
    setIsEditing(false);
    setTags([]);
    setTagInput('');
  }, [noteContent, onAddNote, tags]);

  const handleCancel = useCallback(() => {
    savingNoteRef.current = false; // Reset guard on cancel
    setIsEditing(false);
    onNoteContentChange('');
    setContentError('');
    setTags([]);
    setTagInput('');
  }, [onNoteContentChange]);

  const handleOpenEditor = useCallback(() => {
    savingNoteRef.current = false; // Reset guard for new editor session
    setIsEditing(true);
    setContentError('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleCancel],
  );

  // Edit existing note handlers
  const handleStartEdit = useCallback((note: { id: string; content: string }) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  }, []);

  const handleSaveEdit = useCallback(
    (noteId: string) => {
      if (!editContent.trim()) return;
      updateNote(nodeId, noteId, editContent.trim());
      setEditingNoteId(null);
      setEditContent('');
    },
    [editContent, nodeId, updateNote],
  );

  return (
    <div className="space-y-3" data-testid="notes-tab">
      {/* Add Note button / inline editor */}
      {!isEditing ? (
        <button
          onClick={handleOpenEditor}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 touch-target"
          data-testid="add-note-button"
        >
          <Plus className="w-3 h-3" />
          Add Note
        </button>
      ) : (
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50" data-testid="note-editor">
          <div className="text-xs font-medium text-gray-500 uppercase">New Note</div>
          <div>
            <label htmlFor="note-author" className="text-xs text-gray-500">
              Author
            </label>
            <input
              id="note-author"
              type="text"
              value={noteAuthor}
              onChange={(e) => onNoteAuthorChange(e.target.value)}
              className="w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white border-gray-200 focus:border-blue-400 focus:outline-none"
              placeholder="Author name"
              data-testid="note-author-input"
            />
          </div>
          <div>
            <label htmlFor="note-content" className="text-xs text-gray-500">
              Content
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => {
                onNoteContentChange(e.target.value);
                if (contentError) setContentError('');
              }}
              onKeyDown={handleKeyDown}
              id="note-content"
              className={`w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white resize-none focus:outline-none ${contentError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
              rows={3}
              placeholder="Write your note (markdown supported)..."
              autoFocus
              data-testid="note-content-input"
            />
            {contentError && (
              <div className="text-xs text-red-500 mt-0.5" data-testid="note-content-error">
                {contentError}
              </div>
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
                placeholder={tags.length === 0 ? 'Type tag and press Enter...' : ''}
                aria-label="Add tag"
                className="flex-1 min-w-[80px] text-xs border-none outline-none bg-transparent px-1 py-0.5"
                data-testid="note-tags-input"
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Press Enter or comma to add tags</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 touch-target"
              data-testid="save-note-button"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 touch-target"
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
          <div className="text-sm text-gray-400 text-center py-4" data-testid="notes-empty-state">
            No notes yet
          </div>
        ) : (
          sortedNotes.map((note) => {
            return (
              <div key={note.id} className="border rounded-lg p-3 bg-white" data-testid={`note-${note.id}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {note.author.toLowerCase() === 'ai' ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200"
                        data-testid="note-author"
                        data-author-type="ai"
                      >
                        <Bot className="w-3 h-3" />
                        AI
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-700" data-testid="note-author">
                        {note.author}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs text-gray-400"
                    data-testid="note-timestamp"
                    title={new Date(note.timestampMs).toLocaleString()}
                  >
                    {formatRelativeTime(note.timestampMs)}
                  </span>
                </div>
                {/* Note content - dimmed text for dismissed notes */}
                {editingNoteId === note.id ? (
                  <div className="space-y-2 mt-1" data-testid="note-edit-form">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      aria-label="Edit note content"
                      className="w-full text-sm border rounded px-2 py-1.5 bg-white border-gray-200 focus:border-blue-400 focus:outline-none resize-none"
                      rows={3}
                      data-testid="note-edit-input"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingNoteId(null);
                          setEditContent('');
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(note.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        data-testid="save-edit-button"
                      >
                        <Check className="w-3 h-3" />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingNoteId(null);
                          setEditContent('');
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        data-testid="cancel-edit-button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-gray-100 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 text-gray-800"
                    data-testid="note-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
                  />
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span data-testid="note-id">ID: {note.id}</span>
                    <span data-testid="note-status">Status: {note.status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Edit button - only show when not editing */}
                    {editingNoteId !== note.id && (
                      <button
                        onClick={() => handleStartEdit(note)}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded hover:bg-blue-50 transition-colors touch-target"
                        title="Edit note"
                        data-testid={`edit-note-${note.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeNote(nodeId, note.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors touch-target"
                      title="Delete note"
                      data-testid={`delete-note-${note.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CodeRefsTab({
  node,
  nodeId,
}: {
  node: NonNullable<ReturnType<typeof findNode>>;
  nodeId: string;
}) {
  const addCodeRef = useCoreStore((s) => s.addCodeRef);
  const [isAdding, setIsAdding] = useState(false);
  const [path, setPath] = useState('');
  const [role, setRole] = useState<
    'source' | 'api-spec' | 'schema' | 'deployment' | 'config' | 'test'
  >('source');
  const [pathError, setPathError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyPath = useCallback(async (refPath: string, index: number) => {
    try {
      const clipboard = getClipboardAdapter();
      await clipboard.copyText(refPath);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Silently fail if clipboard is unavailable
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
      case 'source':
        return <FileCode className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'api-spec':
        return <FileText className="w-4 h-4 text-green-500 shrink-0" />;
      case 'schema':
        return <Database className="w-4 h-4 text-purple-500 shrink-0" />;
      case 'deployment':
        return <Cloud className="w-4 h-4 text-orange-500 shrink-0" />;
      case 'config':
        return <Cog className="w-4 h-4 text-gray-500 shrink-0" />;
      case 'test':
        return <TestTube2 className="w-4 h-4 text-yellow-500 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-gray-400 shrink-0" />;
    }
  };

  const getRoleBadgeStyle = (refRole: string): string => {
    switch (refRole) {
      case 'source':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'api-spec':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'schema':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'deployment':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'config':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'test':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getRoleBadgeLabel = (refRole: string): string => {
    switch (refRole) {
      case 'source':
        return 'Source';
      case 'api-spec':
        return 'API Spec';
      case 'schema':
        return 'Schema';
      case 'deployment':
        return 'Deployment';
      case 'config':
        return 'Config';
      case 'test':
        return 'Test';
      default:
        return refRole;
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [handleSubmit],
  );

  return (
    <div className="space-y-3" data-testid="coderefs-tab">
      {/* Add Code Reference button / form */}
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 touch-target"
          data-testid="add-coderef-button"
        >
          <Plus className="w-3 h-3" />
          Add Code Reference
        </button>
      ) : (
        <div className="border rounded-lg p-3 bg-gray-50 space-y-2" data-testid="add-coderef-form">
          <div className="text-xs font-medium text-gray-500 uppercase">Add Code Reference</div>
          <div>
            <label htmlFor="coderef-path" className="text-xs text-gray-500">
              File Path
            </label>
            <input
              id="coderef-path"
              type="text"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                if (pathError) setPathError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., src/api/handler.ts"
              className={`w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white focus:outline-none ${pathError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-blue-400'}`}
              autoFocus
              data-testid="coderef-path-input"
            />
            {pathError && (
              <div className="text-xs text-red-500 mt-0.5" data-testid="coderef-path-error">
                {pathError}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="coderef-role" className="text-xs text-gray-500">
              Role
            </label>
            <select
              id="coderef-role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full mt-0.5 text-sm border rounded px-2 py-1 bg-white border-gray-200 focus:border-blue-400 focus:outline-none"
              data-testid="coderef-role-select"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 touch-target"
              data-testid="submit-coderef-button"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setPath('');
                setRole('source');
                setPathError('');
              }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 touch-target"
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
          <div
            className="text-sm text-gray-400 text-center py-4"
            data-testid="coderefs-empty-state"
          >
            No code references
          </div>
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
                <div className="mt-0.5" data-testid="coderef-icon">
                  {getRoleIcon(ref.role)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono truncate" data-testid="coderef-path">
                    {ref.path}
                  </div>
                  <span
                    className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border mt-0.5 ${getRoleBadgeStyle(ref.role)}`}
                    data-testid="coderef-role"
                  >
                    {getRoleBadgeLabel(ref.role)}
                  </span>
                </div>
                <div className="mt-0.5 shrink-0" data-testid={`coderef-copy-${i}`}>
                  {copiedIndex === i ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                  )}
                </div>
                {copiedIndex === i && (
                  <div
                    className="absolute right-2 top-0 -translate-y-full bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg"
                    data-testid="copy-feedback"
                  >
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
