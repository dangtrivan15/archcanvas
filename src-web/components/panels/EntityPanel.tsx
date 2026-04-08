import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useFileStore } from '../../store/fileStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useGraphStore } from '../../store/graphStore';
import { getEntitiesForCanvas, findEntityUsages } from '../../core/entity/resolver';
import type { ResolvedProject } from '../../storage/fileResolver';
import type { Entity } from '../../types/schema';
import type { EntityUsage } from '../../core/entity/resolver';
import { duration, ease } from '@/lib/motion';

function CreateEntityForm({
  canvasId,
  onClose,
}: {
  canvasId: string;
  onClose: () => void;
}) {
  const prefersReduced = useReducedMotion();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [codeRefsInput, setCodeRefsInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entity: { name: string; description?: string; codeRefs?: string[] } = { name: trimmed };
    const desc = description.trim();
    if (desc) entity.description = desc;
    const refs = codeRefsInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (refs.length > 0) entity.codeRefs = refs;

    const result = useGraphStore.getState().addEntity(canvasId, entity);
    if (!result.ok) {
      if (result.error.code === 'DUPLICATE_ENTITY') {
        setError(`Entity "${trimmed}" already exists`);
      } else {
        setError(result.error.code);
      }
      return;
    }
    onClose();
  };

  return (
    <motion.div
      initial={prefersReduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      transition={{ duration: duration.moderate, ease: ease.out }}
      className="overflow-hidden border-b border-gray-200 dark:border-gray-700"
    >
      <div
        className="p-3 space-y-2"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="Entity name"
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 resize-none"
          rows={2}
        />
        <input
          type="text"
          value={codeRefsInput}
          onChange={(e) => setCodeRefsInput(e.target.value)}
          placeholder="Code refs (comma-separated, optional)"
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
        />
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700"
          >
            Create
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EntityRow({
  entity,
  project,
  canvasId,
  expanded,
  onToggle,
}: {
  entity: Entity;
  project: ResolvedProject;
  canvasId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const prefersReduced = useReducedMotion();
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(entity.description ?? '');
  const [editCodeRefs, setEditCodeRefs] = useState((entity.codeRefs ?? []).join(', '));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const usages = useMemo(() => {
    if (!expanded) return [];
    return findEntityUsages(project, entity.name);
  }, [expanded, project, entity.name]);

  const handleEdit = () => {
    setEditDescription(entity.description ?? '');
    setEditCodeRefs((entity.codeRefs ?? []).join(', '));
    setIsEditing(true);
  };

  const handleSave = () => {
    const updates: { description?: string; codeRefs?: string[] } = {};
    updates.description = editDescription.trim();
    const refs = editCodeRefs.split(',').map((s) => s.trim()).filter(Boolean);
    updates.codeRefs = refs;
    useGraphStore.getState().updateEntity(canvasId, entity.name, updates);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const result = useGraphStore.getState().removeEntity(canvasId, entity.name);
    if (!result.ok && result.error.code === 'ENTITY_IN_USE') {
      setDeleteError(`Entity "${entity.name}" is referenced by edges. Remove edge references first.`);
      setConfirmDelete(false);
      return;
    }
    setConfirmDelete(false);
  };

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
        <motion.span
          className="text-xs text-gray-400 ml-2 inline-block"
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={prefersReduced ? { duration: 0 } : { duration: duration.moderate, ease: ease.out }}
        >
          {'\u25B8'}
        </motion.span>
      </button>
      {expanded && (
        <motion.div
          initial={prefersReduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: duration.moderate, ease: ease.out }}
          className="overflow-hidden"
        >
          <div className="px-3 pb-2 space-y-2">
            {/* Action buttons */}
            <div className="flex gap-1 justify-end">
              <button
                onClick={handleEdit}
                className="text-xs text-gray-500 hover:text-blue-600 px-1"
                title="Edit entity"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-500 hover:text-red-600 px-1"
                title="Delete entity"
              >
                Delete
              </button>
            </div>

            {/* Delete confirmation */}
            {confirmDelete && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 space-y-1">
                <p className="text-xs text-red-700 dark:text-red-300">Delete &ldquo;{entity.name}&rdquo;?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="text-xs bg-red-600 text-white rounded px-2 py-0.5 hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Delete error */}
            {deleteError && (
              <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
            )}

            {/* Edit mode */}
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-medium text-gray-500">Name</span>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{entity.name}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">Description</span>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">Code refs</span>
                  <input
                    type="text"
                    value={editCodeRefs}
                    onChange={(e) => setEditCodeRefs(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    placeholder="Comma-separated paths"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {entity.description && (
                  <motion.p
                    initial={prefersReduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: duration.normal, delay: 0.1, ease: ease.out }}
                    className="text-xs text-gray-600 dark:text-gray-300"
                  >
                    {entity.description}
                  </motion.p>
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
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function EntityPanel() {
  const [filter, setFilter] = useState('');
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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

  const prefersReduced = useReducedMotion();

  if (!project) {
    return <div className="p-4 text-sm text-gray-500">No project loaded</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Entities</h3>
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            + New Entity
          </button>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter entities..."
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
        />
      </div>
      {showCreateForm && (
        <CreateEntityForm
          canvasId={currentCanvasId}
          onClose={() => setShowCreateForm(false)}
        />
      )}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <motion.div
            className="p-4 text-sm text-gray-500"
            initial={prefersReduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.moderate, ease: ease.out }}
          >
            No entities in this scope
          </motion.div>
        ) : (
          filtered.map((entity) => (
            <EntityRow
              key={entity.name}
              entity={entity}
              project={project}
              canvasId={currentCanvasId}
              expanded={expandedEntity === entity.name}
              onToggle={() => {
                const expanding = expandedEntity !== entity.name;
                setExpandedEntity(expanding ? entity.name : null);
                if (expanding) {
                  // Highlight edges referencing this entity in the current canvas
                  const canvas = useFileStore.getState().getCanvas(currentCanvasId);
                  const edgeIds = (canvas?.data.edges ?? [])
                    .filter((e) => e.entities?.includes(entity.name))
                    .map((e) => `${e.from.node}-${e.to.node}`);
                  useCanvasStore.getState().highlightEdges(edgeIds);
                } else {
                  useCanvasStore.getState().clearHighlight();
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
