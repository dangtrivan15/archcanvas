import { useState, useCallback, useEffect } from 'react';
import { Command } from 'cmdk';
import { motion, useReducedMotion } from 'motion/react';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import type { Node } from '@/types';
import { listNodes } from '@/core/graph/query';
import { listAllEntities } from '@/core/entity/resolver';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useHistoryStore } from '@/store/historyStore';
import { useUiStore } from '@/store/uiStore';
import { useToolStore } from '@/store/toolStore';
import { resolveIcon } from '@/components/nodes/iconMap';
import { createNodeFromType } from '@/lib/createNodeFromType';

// ---------------------------------------------------------------------------
// Provider interfaces
// ---------------------------------------------------------------------------

interface PaletteResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  category: string;
}

interface PaletteProvider {
  category: string;
  search(query: string): PaletteResult[];
  onSelect(result: PaletteResult): void;
}

// ---------------------------------------------------------------------------
// Prefix constants
// ---------------------------------------------------------------------------

const PREFIX_ACTIONS = '>';
const PREFIX_NODES = '@';
const PREFIX_ENTITIES = '#';
const PREFIX_ADD = '+';

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

const NodeSearchProvider: PaletteProvider = {
  category: 'Nodes',

  search(query: string): PaletteResult[] {
    const { currentCanvasId } = useNavigationStore.getState();
    const canvas = useFileStore.getState().getCanvas(currentCanvasId);
    if (!canvas) return [];

    const nodes: Node[] = listNodes(canvas.data);
    const q = query.toLowerCase();

    return nodes
      .filter((node) => {
        if (q === '') return true;
        const displayName = 'displayName' in node ? (node.displayName ?? node.id) : node.id;
        const type = 'type' in node ? node.type : '';
        return (
          displayName.toLowerCase().includes(q) ||
          node.id.toLowerCase().includes(q) ||
          type.toLowerCase().includes(q)
        );
      })
      .map((node) => {
        const isInline = 'type' in node;
        const displayName = isInline
          ? ((node as { displayName?: string }).displayName ?? node.id)
          : node.id;
        const subtitle = isInline ? (node as { type: string }).type : 'ref';
        return {
          id: `node:${node.id}`,
          title: displayName,
          subtitle,
          icon: '◈',
          category: 'Nodes',
        };
      });
  },

  onSelect(result: PaletteResult) {
    const nodeId = result.id.replace(/^node:/, '');
    useCanvasStore.getState().selectNodes([nodeId]);
  },
};

// ---------------------------------------------------------------------------
// Action helpers
// ---------------------------------------------------------------------------

interface ActionDef {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  category: string;
  execute: () => void;
}

function filterActions(actions: ActionDef[], query: string): PaletteResult[] {
  if (query === '') return actions;
  const q = query.toLowerCase();
  return actions.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      (a.subtitle ?? '').toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q),
  );
}

function createActionProvider(category: string, actions: ActionDef[]): PaletteProvider {
  return {
    category,
    search: (query) => filterActions(actions, query),
    onSelect: (result) => actions.find((a) => a.id === result.id)?.execute(),
  };
}

// ---------------------------------------------------------------------------
// Action definitions by category
// ---------------------------------------------------------------------------

const fileActions: ActionDef[] = [
  { id: 'action:open', title: 'Open…', subtitle: '⌘O', icon: '📂', category: 'File', execute: () => useFileStore.getState().open() },
  { id: 'action:save', title: 'Save', subtitle: '⌘S', icon: '💾', category: 'File', execute: () => useFileStore.getState().save() },
  { id: 'action:export', title: 'Export\u2026', subtitle: '⇧⌘E', icon: '📤', category: 'File', execute: () => useUiStore.getState().openExportDialog() },
  { id: 'action:export-png', title: 'Export as PNG', subtitle: 'Raster image', icon: '🖼', category: 'File', execute: () => {
    import('@/export').then(({ exportAndSave }) => exportAndSave({ format: 'png' })).catch((err) => {
      console.error('Export failed:', err);
      window.alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  } },
  { id: 'action:export-svg', title: 'Export as SVG', subtitle: 'Vector image', icon: '🖼', category: 'File', execute: () => {
    import('@/export').then(({ exportAndSave }) => exportAndSave({ format: 'svg' })).catch((err) => {
      console.error('Export failed:', err);
      window.alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  } },
  { id: 'action:export-md', title: 'Export as Markdown', subtitle: 'Text + Mermaid', icon: '📝', category: 'File', execute: () => {
    import('@/export').then(({ exportAndSave }) => exportAndSave({ format: 'markdown' })).catch((err) => {
      console.error('Export failed:', err);
      window.alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  } },
];

const editActions: ActionDef[] = [
  { id: 'action:undo', title: 'Undo', subtitle: '⌘Z', icon: '↩', category: 'Edit', execute: () => useHistoryStore.getState().undo() },
  { id: 'action:redo', title: 'Redo', subtitle: '⇧⌘Z', icon: '↪', category: 'Edit', execute: () => useHistoryStore.getState().redo() },
  { id: 'action:select-all', title: 'Select All', subtitle: '⌘A', icon: '⊡', category: 'Edit', execute: () => {
    const canvasId = useNavigationStore.getState().currentCanvasId;
    const canvas = useFileStore.getState().getCanvas(canvasId);
    if (canvas) {
      const nodes = listNodes(canvas.data);
      useCanvasStore.getState().selectNodes(nodes.map((n) => n.id));
    }
  }},
  { id: 'action:clear-selection', title: 'Clear Selection', subtitle: 'Esc', icon: '⊘', category: 'Edit', execute: () => useCanvasStore.getState().clearSelection() },
  { id: 'action:delete-selection', title: 'Delete Selection', subtitle: 'Delete', icon: '🗑', category: 'Edit', execute: () => useCanvasStore.getState().deleteSelection(useNavigationStore.getState().currentCanvasId) },
  { id: 'action:create-subsystem', title: 'Create Subsystem...', icon: '⊞', category: 'Edit',
    execute: () => setTimeout(() => window.dispatchEvent(
      new CustomEvent('archcanvas:open-palette', { detail: { mode: 'subsystem' } }),
    ), 0),
  },
];

const viewActions: ActionDef[] = [
  { id: 'action:fit-view', title: 'Fit View', subtitle: 'Reset viewport to show all nodes', icon: '⊡', category: 'View', execute: () => window.dispatchEvent(new CustomEvent('archcanvas:fit-view')) },
  { id: 'action:auto-layout', title: 'Auto Layout', subtitle: 'Arrange nodes automatically', icon: '⊞', category: 'View', execute: () => window.dispatchEvent(new CustomEvent('archcanvas:auto-layout')) },
  { id: 'action:toggle-left-panel', title: 'Toggle Left Panel', icon: '◧', category: 'View', execute: () => useUiStore.getState().toggleLeftPanel() },
  { id: 'action:toggle-right-panel', title: 'Toggle Right Panel', icon: '◨', category: 'View', execute: () => useUiStore.getState().toggleRightPanel() },
  { id: 'action:open-chat', title: 'Open AI Chat', subtitle: '⇧⌘I', icon: '💬', category: 'View', execute: () => { useUiStore.getState().openRightPanel(); useUiStore.getState().setRightPanelMode('chat'); setTimeout(() => window.dispatchEvent(new CustomEvent('archcanvas:focus-chat')), 0); } },
  { id: 'action:appearance', title: 'Appearance\u2026', subtitle: 'Theme, mode, text size', icon: '🎨', category: 'View', execute: () => useUiStore.getState().openAppearanceDialog() },
];

const toolActions: ActionDef[] = [
  { id: 'action:tool-select', title: 'Select Mode', subtitle: 'Default pointer tool', icon: '🔘', category: 'Tool', execute: () => useToolStore.getState().setMode('select') },
  { id: 'action:tool-pan', title: 'Pan Mode', subtitle: 'Drag to pan the canvas', icon: '✋', category: 'Tool', execute: () => useToolStore.getState().setMode('pan') },
];

const FileActionProvider = createActionProvider('File', fileActions);
const EditActionProvider = createActionProvider('Edit', editActions);
const ViewActionProvider = createActionProvider('View', viewActions);
const ToolActionProvider = createActionProvider('Tool', toolActions);

const NodeTypeProvider: PaletteProvider = {
  category: 'Node types',

  search(query: string): PaletteResult[] {
    const results = useRegistryStore.getState().search(query === '' ? '' : query);
    return results.map((nodeDef) => ({
      id: `nodetype:${nodeDef.metadata.namespace}/${nodeDef.metadata.name}`,
      title: nodeDef.metadata.displayName ?? nodeDef.metadata.name,
      subtitle: `${nodeDef.metadata.namespace}/${nodeDef.metadata.name}`,
      icon: nodeDef.metadata.icon ?? '◻',
      category: 'Node types',
    }));
  },

  onSelect(result: PaletteResult) {
    const typeKey = result.id.replace(/^nodetype:/, '');
    const canvasId = useNavigationStore.getState().currentCanvasId;
    createNodeFromType(canvasId, typeKey);
  },
};

const EntityProvider: PaletteProvider = {
  category: 'Entities',

  search(query: string): PaletteResult[] {
    const project = useFileStore.getState().project;
    if (!project) return [];

    const allEntities = listAllEntities(project);
    const q = query.toLowerCase();

    return allEntities
      .filter((entity) => {
        if (q === '') return true;
        return (
          entity.name.toLowerCase().includes(q) ||
          (entity.description ?? '').toLowerCase().includes(q)
        );
      })
      .map((entity) => ({
        id: `entity:${entity.name}`,
        title: entity.name,
        subtitle: entity.description
          ? `${entity.description} — ${entity.definedIn.join(', ')}`
          : entity.definedIn.join(', '),
        icon: '⬡',
        category: 'Entities',
      }));
  },

  onSelect(result: PaletteResult) {
    const entityName = result.id.replace(/^entity:/, '');
    const project = useFileStore.getState().project;
    if (!project) return;

    // Find the first canvas that defines this entity and navigate there
    const allEntities = listAllEntities(project);
    const entity = allEntities.find((e) => e.name === entityName);
    if (entity && entity.definedIn.length > 0) {
      useNavigationStore.getState().navigateTo(entity.definedIn[0]);
    }

    // Switch to entities panel
    useUiStore.getState().setRightPanelMode('entities');
    useUiStore.getState().openRightPanel();
  },
};

const ScopeProvider: PaletteProvider = {
  category: 'Scopes',

  search(query: string): PaletteResult[] {
    const project = useFileStore.getState().project;
    if (!project) return [];

    const q = query.toLowerCase();
    const results: PaletteResult[] = [];

    for (const [canvasId, loaded] of project.canvases) {
      const displayName = canvasId === '__root__'
        ? 'Root'
        : (loaded.data.displayName ?? canvasId);
      if (q === '' || displayName.toLowerCase().includes(q) || canvasId.toLowerCase().includes(q)) {
        results.push({
          id: `scope:${canvasId}`,
          title: displayName,
          subtitle: canvasId === '__root__' ? 'Root scope' : canvasId,
          icon: '⬜',
          category: 'Scopes',
        });
      }
    }

    return results;
  },

  onSelect(result: PaletteResult) {
    const canvasId = result.id.replace(/^scope:/, '');
    useNavigationStore.getState().navigateTo(canvasId);
  },
};

// ---------------------------------------------------------------------------
// All providers in render order
// ---------------------------------------------------------------------------

const ACTION_PROVIDERS: PaletteProvider[] = [
  FileActionProvider,
  EditActionProvider,
  ViewActionProvider,
  ToolActionProvider,
];

const ALL_PROVIDERS: PaletteProvider[] = [
  ...ACTION_PROVIDERS,
  NodeSearchProvider,
  NodeTypeProvider,
  EntityProvider,
  ScopeProvider,
];

// ---------------------------------------------------------------------------
// Prefix filtering
// ---------------------------------------------------------------------------

function resolveProviders(raw: string): { providers: PaletteProvider[]; query: string } {
  if (raw.startsWith(PREFIX_ACTIONS)) {
    return { providers: ACTION_PROVIDERS, query: raw.slice(1).trimStart() };
  }
  if (raw.startsWith(PREFIX_NODES)) {
    return { providers: [NodeSearchProvider], query: raw.slice(1).trimStart() };
  }
  if (raw.startsWith(PREFIX_ENTITIES)) {
    return { providers: [EntityProvider], query: raw.slice(1).trimStart() };
  }
  if (raw.startsWith(PREFIX_ADD)) {
    return { providers: [NodeTypeProvider], query: raw.slice(1).trimStart() };
  }
  return { providers: ALL_PROVIDERS, query: raw };
}

// ---------------------------------------------------------------------------
// CommandPalette component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  initialInput?: string;
  mode?: 'default' | 'subsystem';
  onSelectSubsystemType?: (type: string) => void;
}

export function CommandPalette({ open, onClose, initialInput = '', mode = 'default', onSelectSubsystemType }: CommandPaletteProps) {
  const [inputValue, setInputValue] = useState('');
  const prefersReduced = useReducedMotion();

  // Seed the input when the palette opens with a prefix (e.g. "@" from Add Node button)
  useEffect(() => {
    if (open) setInputValue(initialInput);
  }, [open, initialInput]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose();
        setInputValue('');
      }
    },
    [onClose],
  );

  const { providers: resolvedProviders, query } = resolveProviders(inputValue);

  // In subsystem mode, only show NodeTypeProvider (user picks a type for the subsystem)
  const providers = mode === 'subsystem' ? [NodeTypeProvider] : resolvedProviders;

  // Collect grouped results — we disable cmdk's built-in filter because we
  // handle filtering ourselves per-provider to support the prefix shortcuts.
  const groups: { provider: PaletteProvider; results: PaletteResult[] }[] = providers.map(
    (p) => ({ provider: p, results: p.search(query) }),
  ).filter((g) => g.results.length > 0);

  const handleSelect = useCallback(
    (provider: PaletteProvider, result: PaletteResult) => {
      // Intercept node type selection in subsystem mode — hand off to Canvas
      if (mode === 'subsystem' && result.id.startsWith('nodetype:')) {
        const typeKey = result.id.replace(/^nodetype:/, '');
        onSelectSubsystemType?.(typeKey);
        onClose();
        setInputValue('');
        return;
      }
      provider.onSelect(result);
      onClose();
      setInputValue('');
    },
    [onClose, mode, onSelectSubsystemType],
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
      label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      overlayClassName="fixed inset-0 z-40 bg-black/40"
      contentClassName="w-full max-w-xl"
    >
      {/* Click-outside backdrop — closes palette when clicking outside the content */}
      <div className="fixed inset-0 z-[-1]" onClick={onClose} />
      <motion.div
        className="w-full max-w-xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
        initial={prefersReduced ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <VisuallyHidden.Root asChild>
          <h2>Command palette</h2>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <p>Search commands, nodes, and entities</p>
        </VisuallyHidden.Root>
        <Command.Input
          value={inputValue}
          onValueChange={setInputValue}
          placeholder={mode === 'subsystem'
            ? "Pick a node type for the subsystem..."
            : "Type a command or search… (> actions, @ nodes, # entities, + add node)"}
          className="w-full border-b border-border bg-popover px-4 py-3 text-sm text-popover-foreground outline-none placeholder:text-muted-foreground"
        />

        <Command.List className="max-h-80 overflow-y-auto p-1">
          {groups.length === 0 && (
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
          )}

          {groups.map(({ provider, results }) => (
            <Command.Group
              key={provider.category}
              heading={provider.category}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
            >
              {results.map((result) => (
                <Command.Item
                  key={result.id}
                  value={result.id}
                  onSelect={() => handleSelect(provider, result)}
                  className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm text-popover-foreground aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground hover:bg-accent/50"
                >
                  {result.icon && (() => {
                    const Icon = resolveIcon(result.icon);
                    return (
                      <span className="shrink-0 text-base text-muted-foreground" aria-hidden>
                        {Icon ? <Icon className="h-4 w-4" /> : result.icon}
                      </span>
                    );
                  })()}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{result.title}</span>
                    {result.subtitle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </motion.div>
    </Command.Dialog>
  );
}
