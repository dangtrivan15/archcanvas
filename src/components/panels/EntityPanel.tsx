import { useState, useMemo } from 'react';
import { useFileStore } from '../../store/fileStore';
import { useNavigationStore } from '../../store/navigationStore';
import { getEntitiesForCanvas, findEntityUsages } from '../../core/entity/resolver';
import type { ResolvedProject } from '../../storage/fileResolver';
import type { Entity } from '../../types/schema';
import type { EntityUsage } from '../../core/entity/resolver';

function EntityRow({
  entity,
  project,
  expanded,
  onToggle,
}: {
  entity: Entity;
  project: ResolvedProject;
  expanded: boolean;
  onToggle: () => void;
}) {
  const usages = useMemo(() => {
    if (!expanded) return [];
    return findEntityUsages(project, entity.name);
  }, [expanded, project, entity.name]);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between"
      >
        <div className="min-w-0">
          <span className="text-sm font-medium">{entity.name}</span>
          {entity.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{entity.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 ml-2">{expanded ? '\u25BE' : '\u25B8'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-2">
          {entity.description && (
            <p className="text-xs text-gray-600 dark:text-gray-300">{entity.description}</p>
          )}
          {entity.codeRefs && entity.codeRefs.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500">Code refs:</span>
              <ul className="ml-2">
                {entity.codeRefs.map((ref) => (
                  <li key={ref} className="text-xs text-gray-500 font-mono">{ref}</li>
                ))}
              </ul>
            </div>
          )}
          {usages.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500">Used in:</span>
              <ul className="ml-2">
                {usages.map((usage: EntityUsage) => (
                  <li key={usage.canvasId} className="text-xs text-gray-500">
                    {usage.canvasDisplayName} ({usage.edges.length} edge{usage.edges.length !== 1 ? 's' : ''})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {usages.length === 0 && (
            <p className="text-xs text-gray-400 italic">Not referenced on any edges</p>
          )}
        </div>
      )}
    </div>
  );
}

export function EntityPanel() {
  const [filter, setFilter] = useState('');
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const project = useFileStore((s) => s.project);
  const currentCanvasId = useNavigationStore((s) => s.currentCanvasId);

  const entities = useMemo(() => {
    if (!project) return [];
    return getEntitiesForCanvas(project, currentCanvasId);
  }, [project, currentCanvasId]);

  const filtered = useMemo(() => {
    if (!filter) return entities;
    const q = filter.toLowerCase();
    return entities.filter((e) => e.name.toLowerCase().includes(q));
  }, [entities, filter]);

  if (!project) {
    return <div className="p-4 text-sm text-gray-500">No project loaded</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold mb-2">Entities</h3>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter entities..."
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No entities in this scope</div>
        ) : (
          filtered.map((entity) => (
            <EntityRow
              key={entity.name}
              entity={entity}
              project={project}
              expanded={expandedEntity === entity.name}
              onToggle={() =>
                setExpandedEntity(expandedEntity === entity.name ? null : entity.name)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
