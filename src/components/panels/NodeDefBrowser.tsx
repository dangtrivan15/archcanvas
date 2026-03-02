/**
 * NodeDefBrowser - left panel that lists all available NodeDef types.
 * Provides a search input to filter nodedefs by name, description, or tags.
 * Groups nodedefs by namespace (compute, data, messaging, network, observability).
 */

import { useMemo, useState, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import {
  Box, Server, Database, HardDrive, Radio, Globe, Shield, Cpu, Layers,
} from 'lucide-react';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
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

export function NodeDefBrowser() {
  const registry = useCoreStore((s) => s.registry);
  const placementMode = useUIStore((s) => s.placementMode);
  const placementInfo = useUIStore((s) => s.placementInfo);
  const enterPlacementMode = useUIStore((s) => s.enterPlacementMode);
  const exitPlacementMode = useUIStore((s) => s.exitPlacementMode);
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
    const sorted: [string, NodeDef[]][] = Object.entries(groups).sort(
      ([a], [b]) => a.localeCompare(b),
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

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [],
  );

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

  return (
    <div className="h-full flex flex-col" data-testid="nodedef-browser">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">Node Types</h2>
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
                             cursor-pointer select-none"
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
                                     border-l-2 transition-colors
                                     ${isActive
                                       ? 'bg-blue-100 border-blue-500 ring-1 ring-blue-300'
                                       : 'border-transparent hover:bg-blue-50 hover:border-blue-400'
                                     }`}
                          data-testid={`nodedef-entry-${typeKey}`}
                          title={def.metadata.description}
                          onClick={() => handleNodeDefClick(typeKey, def.metadata.displayName)}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/archcanvas-nodedef', JSON.stringify({
                              nodeType: typeKey,
                              displayName: def.metadata.displayName,
                            }));
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium truncate ${isActive ? 'text-blue-800' : 'text-gray-800'}`}>
                              {def.metadata.displayName}
                            </div>
                            <div className={`text-xs truncate ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                              {typeKey}
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
