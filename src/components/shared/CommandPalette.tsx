import { useState, useCallback } from 'react';
import { Command } from 'cmdk';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import type { Node, Entity } from '@/types';
import { listNodes, listEntities, findEdgesReferencingEntity } from '@/core/graph/query';
import { useFileStore } from '@/store/fileStore';
import { useRegistryStore } from '@/store/registryStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useGraphStore } from '@/store/graphStore';
import { useHistoryStore } from '@/store/historyStore';
import { resolveIcon } from '@/components/nodes/iconMap';

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

const ActionProvider: PaletteProvider = {
  category: 'Actions',

  search(query: string): PaletteResult[] {
    const actions: PaletteResult[] = [
      { id: 'action:undo', title: 'Undo', subtitle: 'Ctrl+Z / ⌘Z', icon: '↩', category: 'Actions' },
      { id: 'action:redo', title: 'Redo', subtitle: 'Ctrl+Shift+Z / ⌘⇧Z', icon: '↪', category: 'Actions' },
      { id: 'action:fit-view', title: 'Fit View', subtitle: 'Reset viewport to show all nodes', icon: '⊡', category: 'Actions' },
      { id: 'action:auto-layout', title: 'Auto Layout', subtitle: 'Arrange nodes automatically', icon: '⊞', category: 'Actions' },
    ];

    if (query === '') return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subtitle ?? '').toLowerCase().includes(q),
    );
  },

  onSelect(result: PaletteResult) {
    switch (result.id) {
      case 'action:undo':
        useHistoryStore.getState().undo();
        break;
      case 'action:redo':
        useHistoryStore.getState().redo();
        break;
      case 'action:fit-view':
        // Fit view is handled by ReactFlow — dispatch a custom event that
        // the canvas can listen to, or no-op until Task 15 wires it up.
        window.dispatchEvent(new CustomEvent('archcanvas:fit-view'));
        break;
      case 'action:auto-layout':
        window.dispatchEvent(new CustomEvent('archcanvas:auto-layout'));
        break;
    }
  },
};

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
    const canvas = useFileStore.getState().getCanvas(canvasId);
    const existingCount = canvas?.data.nodes?.length ?? 0;

    // Resolve the NodeDef to get the display name
    const nodeDef = useRegistryStore.getState().resolve(typeKey);
    const baseName = nodeDef?.metadata.displayName ?? typeKey.split('/').pop() ?? 'Node';

    // Count existing nodes of the same type to generate unique name
    const sameTypeCount = (canvas?.data.nodes ?? []).filter(
      (n) => 'type' in n && n.type === typeKey
    ).length;
    const displayName = sameTypeCount === 0 ? baseName : `${baseName} ${sameTypeCount + 1}`;

    // Stagger new nodes so they don't stack on top of each other.
    const col = existingCount % 2;
    const row = Math.floor(existingCount / 2);
    const newNode: Node = {
      id: `node-${crypto.randomUUID().slice(0, 8)}`,
      type: typeKey,
      displayName,
      position: { x: col * 300, y: row * 200 },
    };
    useGraphStore.getState().addNode(canvasId, newNode);
  },
};

const EntityProvider: PaletteProvider = {
  category: 'Entities',

  search(query: string): PaletteResult[] {
    const { currentCanvasId } = useNavigationStore.getState();
    const canvas = useFileStore.getState().getCanvas(currentCanvasId);
    if (!canvas) return [];

    const entities: Entity[] = listEntities(canvas.data);
    const q = query.toLowerCase();

    return entities
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
        subtitle: entity.description,
        icon: '⬡',
        category: 'Entities',
      }));
  },

  onSelect(result: PaletteResult) {
    const entityName = result.id.replace(/^entity:/, '');
    const project = useFileStore.getState().project;
    if (!project) return;

    const refs = findEdgesReferencingEntity(project.canvases, entityName);
    if (refs.length === 0) return;

    const { edge } = refs[0];
    useCanvasStore.getState().selectEdge(edge.from.node, edge.to.node);
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

const ALL_PROVIDERS: PaletteProvider[] = [
  ActionProvider,
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
    return { providers: [ActionProvider], query: raw.slice(1).trimStart() };
  }
  if (raw.startsWith(PREFIX_NODES)) {
    return { providers: [NodeSearchProvider], query: raw.slice(1).trimStart() };
  }
  if (raw.startsWith(PREFIX_ENTITIES)) {
    return { providers: [EntityProvider], query: raw.slice(1).trimStart() };
  }
  return { providers: ALL_PROVIDERS, query: raw };
}

// ---------------------------------------------------------------------------
// CommandPalette component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [inputValue, setInputValue] = useState('');

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose();
        setInputValue('');
      }
    },
    [onClose],
  );

  const { providers, query } = resolveProviders(inputValue);

  // Collect grouped results — we disable cmdk's built-in filter because we
  // handle filtering ourselves per-provider to support the prefix shortcuts.
  const groups: { provider: PaletteProvider; results: PaletteResult[] }[] = providers.map(
    (p) => ({ provider: p, results: p.search(query) }),
  ).filter((g) => g.results.length > 0);

  const handleSelect = useCallback(
    (provider: PaletteProvider, result: PaletteResult) => {
      provider.onSelect(result);
      onClose();
      setInputValue('');
    },
    [onClose],
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
      <div className="w-full max-w-xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <VisuallyHidden.Root asChild>
          <h2>Command palette</h2>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <p>Search commands, nodes, and entities</p>
        </VisuallyHidden.Root>
        <Command.Input
          value={inputValue}
          onValueChange={setInputValue}
          placeholder="Type a command or search… (> actions, @ nodes, # entities)"
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
      </div>
    </Command.Dialog>
  );
}
