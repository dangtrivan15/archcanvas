/**
 * NodeDefBrowser - left panel that lists all available NodeDef types.
 * Provides a search input to filter nodedefs by name, description, or tags.
 * Groups nodedefs by namespace (compute, data, messaging, network, observability).
 */

import { useMemo, useState, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, X } from 'lucide-react';
import { Box, Server, Database, HardDrive, Radio, Globe, Shield, Cpu, Layers } from 'lucide-react';
import { useEngineStore } from '@/store/engineStore';
import { useUIStore } from '@/store/uiStore';
import { useViewportSize } from '@/hooks/useViewportSize';
import { ICON_RAIL_BREAKPOINT } from '@/hooks/useViewportSize';
import type { NodeDef } from '@/types/nodedef';

const iconMap: Record<string, React.ElementType> = {
  Server,
  Database,
  HardDrive,
  Radio,
  Globe,
  Shield,
  Cpu,
  Layers,
  Box,
};

/** Map namespace to a display-friendly label */
const namespaceLabels: Record<string, string> = {
  compute: 'Compute',
  data: 'Data',
  messaging: 'Messaging',
  network: 'Network',
  observability: 'Observability',
};

/** Map namespace to an icon component for rail mode */
const namespaceIcons: Record<string, React.ElementType> = {
  compute: Server,
  data: Database,
  messaging: Radio,
  network: Globe,
  observability: Shield,
};

export function NodeDefBrowser() {
  const registry = useEngineStore((s) => s.registry);
  const placementMode = useUIStore((s) => s.placementMode);
  const placementInfo = useUIStore((s) => s.placementInfo);
  const enterPlacementMode = useUIStore((s) => s.enterPlacementMode);
  const exitPlacementMode = useUIStore((s) => s.exitPlacementMode);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const { width: viewportWidth } = useViewportSize();
  const isIconRail = viewportWidth < ICON_RAIL_BREAKPOINT;
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNamespaces, setCollapsedNamespaces] = useState<Set<string>>(new Set());

  // Get all nodedefs, filtered by search
  const allNodeDefs = useMemo(() => {
    if (!registry) return [];
    if (searchQuery.trim()) {
      return registry.search(searchQuery.trim());
    }
    return registry.listAll();
  }, [registry, searchQuery]);

  // Group by namespace
  const groupedNodeDefs = useMemo(() => {
    const groups: Record<string, NodeDef[]> = {};
    for (const def of allNodeDefs) {
      const ns = def.metadata.namespace;
      if (!groups[ns]) {
        groups[ns] = [];
      }
      groups[ns].push(def);
    }
    // Sort namespaces alphabetically
    const sorted: [string, NodeDef[]][] = Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return sorted;
  }, [allNodeDefs]);

  const toggleNamespace = useCallback((ns: string) => {
    setCollapsedNamespaces((prev) => {
      const next = new Set(prev);
      if (next.has(ns)) {
        next.delete(ns);
      } else {
        next.add(ns);
      }
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleNodeDefClick = useCallback(
    (typeKey: string, displayName: string) => {
      if (placementMode && placementInfo?.nodeType === typeKey) {
        // Clicking the same nodedef again exits placement mode
        exitPlacementMode();
      } else {
        enterPlacementMode({ nodeType: typeKey, displayName });
      }
    },
    [placementMode, placementInfo, enterPlacementMode, exitPlacementMode],
  );

  // Icon-only rail mode for narrow viewports (<500px)
  if (isIconRail) {
    return (
      <div
        className="h-full flex flex-col items-center py-2 gap-1"
        data-testid="nodedef-browser"
        data-mode="icon-rail"
      >
        {/* Close button */}
        <button
          onClick={toggleLeftPanel}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors touch-target mb-1"
          aria-label="Close node types panel"
          data-testid="nodedef-browser-close"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Namespace icons as compact rail */}
        {groupedNodeDefs.map(([namespace, defs]) => {
          const NsIcon = namespaceIcons[namespace] ?? Box;
          return (
            <div
              key={namespace}
              className="flex flex-col items-center gap-0.5"
              data-testid={`nodedef-group-${namespace}`}
            >
              <button
                onClick={() => toggleNamespace(namespace)}
                className="p-2 rounded hover:bg-gray-100 transition-colors touch-target group relative"
                aria-label={namespaceLabels[namespace] || namespace}
                title={`${namespaceLabels[namespace] || namespace} (${defs.length})`}
                data-testid={`nodedef-group-toggle-${namespace}`}
              >
                <NsIcon className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
                {/* Tooltip */}
                <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {namespaceLabels[namespace] || namespace}
                </span>
              </button>
              {/* Show compact node icons when expanded */}
              {!collapsedNamespaces.has(namespace) &&
                defs.map((def) => {
                  const typeKey = `${def.metadata.namespace}/${def.metadata.name}`;
                  const Icon = iconMap[def.metadata.icon] ?? Box;
                  const isActive = placementMode && placementInfo?.nodeType === typeKey;
                  return (
                    <button
                      key={typeKey}
                      className={`p-1.5 rounded transition-colors touch-target group relative
                               ${
                                 isActive ? 'bg-blue-100 ring-1 ring-blue-300' : 'hover:bg-blue-50'
                               }`}
                      onClick={() => handleNodeDefClick(typeKey, def.metadata.displayName)}
                      title={def.metadata.displayName}
                      data-testid={`nodedef-entry-${typeKey}`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      {/* Tooltip */}
                      <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        {def.metadata.displayName}
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="nodedef-browser">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Node Types</h2>
        <button
          onClick={toggleLeftPanel}
          className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors touch-target"
          aria-label="Close node types panel"
          data-testid="nodedef-browser-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search node types..."
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search node types"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-white
                       focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400
                       placeholder:text-gray-400"
            data-testid="nodedef-search-input"
          />
        </div>
      </div>

      {/* NodeDef List */}
      <div className="flex-1 overflow-y-auto" data-testid="nodedef-list">
        {groupedNodeDefs.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-400 text-center">
            {searchQuery ? 'No matching node types' : 'No node types available'}
          </div>
        ) : (
          groupedNodeDefs.map(([namespace, defs]) => {
            const isCollapsed = collapsedNamespaces.has(namespace);
            return (
              <div key={namespace} data-testid={`nodedef-group-${namespace}`}>
                {/* Namespace header */}
                <button
                  onClick={() => toggleNamespace(namespace)}
                  className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-medium
                             text-gray-500 uppercase tracking-wider hover:bg-gray-50
                             cursor-pointer select-none touch-target-row"
                  data-testid={`nodedef-group-toggle-${namespace}`}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  <span>{namespaceLabels[namespace] || namespace}</span>
                  <span className="ml-auto text-gray-400 font-normal normal-case">
                    {defs.length}
                  </span>
                </button>

                {/* NodeDef entries */}
                {!isCollapsed && (
                  <div>
                    {defs.map((def) => {
                      const typeKey = `${def.metadata.namespace}/${def.metadata.name}`;
                      const Icon = iconMap[def.metadata.icon] ?? Box;
                      const isActive = placementMode && placementInfo?.nodeType === typeKey;
                      return (
                        <div
                          key={typeKey}
                          className={`flex items-start gap-2 px-3 py-2 cursor-pointer
                                     border-l-2 transition-colors touch-target-row
                                     ${
                                       isActive
                                         ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-300'
                                         : 'border-transparent hover:bg-blue-50 hover:border-blue-400'
                                     }`}
                          data-testid={`nodedef-entry-${typeKey}`}
                          title={def.metadata.description}
                          onClick={() => handleNodeDefClick(typeKey, def.metadata.displayName)}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/archcanvas-nodedef',
                              JSON.stringify({
                                nodeType: typeKey,
                                displayName: def.metadata.displayName,
                              }),
                            );
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                        >
                          <Icon
                            className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm font-medium truncate ${isActive ? 'text-blue-800' : 'text-gray-800'}`}
                              data-testid={`nodedef-name-${typeKey}`}
                            >
                              {def.metadata.displayName}
                            </div>
                            <div
                              className={`text-xs truncate ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
                              data-testid={`nodedef-desc-${typeKey}`}
                            >
                              {def.metadata.description}
                            </div>
                          </div>
                        </div>
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
