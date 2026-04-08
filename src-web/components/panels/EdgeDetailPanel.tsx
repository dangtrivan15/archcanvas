import { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Edge } from '@/types';
import { useGraphStore } from '@/store/graphStore';
import { useFileStore } from '@/store/fileStore';
import { NotesTab } from './NotesTab';
import { duration, ease, entrance, withReducedMotion } from '@/lib/motion';

interface Props {
  edge: Edge;
  canvasId: string;
}

export function EdgeDetailPanel({ edge, canvasId }: Props) {
  const prefersReduced = useReducedMotion();
  const from = edge.from.node;
  const to = edge.to.node;

  const [label, setLabel] = useState(edge.label ?? '');
  const [protocol, setProtocol] = useState(edge.protocol ?? '');
  const [showEntityInput, setShowEntityInput] = useState(false);
  const [entityQuery, setEntityQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const entities = edge.entities ?? [];
  const notes = edge.notes ?? [];

  // Get all canvas entities for autocomplete
  const canvasEntities = useMemo(() => {
    const canvas = useFileStore.getState().getCanvas(canvasId);
    return canvas?.data.entities ?? [];
  }, [canvasId]);

  // Filter entities for dropdown
  const filteredEntities = useMemo(() => {
    if (!entityQuery.trim()) return [];
    const q = entityQuery.toLowerCase();
    return canvasEntities
      .filter((e) => e.name.toLowerCase().includes(q))
      .filter((e) => !entities.includes(e.name));
  }, [entityQuery, canvasEntities, entities]);

  // Show "Create" option only when no case-insensitive match exists
  const showCreateOption = useMemo(() => {
    const trimmed = entityQuery.trim();
    if (!trimmed) return false;
    const q = trimmed.toLowerCase();
    return !canvasEntities.some((e) => e.name.toLowerCase() === q);
  }, [entityQuery, canvasEntities]);

  const dropdownItems = useMemo(() => {
    const items: { type: 'existing' | 'create'; name: string }[] =
      filteredEntities.map((e) => ({ type: 'existing' as const, name: e.name }));
    if (showCreateOption) {
      items.push({ type: 'create', name: entityQuery.trim() });
    }
    return items;
  }, [filteredEntities, showCreateOption, entityQuery]);

  // Reset highlight when dropdown items change
  useEffect(() => { setHighlightIndex(0); }, [dropdownItems.length]);

  // Close on outside click
  useEffect(() => {
    if (!showEntityInput) return;
    const handler = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShowEntityInput(false);
        setEntityQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEntityInput]);

  const saveField = (updates: { label?: string; protocol?: string }) => {
    useGraphStore.getState().updateEdge(canvasId, from, to, updates);
  };

  const assignEntityToEdge = (name: string) => {
    useGraphStore.getState().updateEdge(canvasId, from, to, {
      entities: [...entities, name],
    });
    setEntityQuery('');
    setShowEntityInput(false);
  };

  const selectItem = (item: { type: 'existing' | 'create'; name: string }) => {
    if (item.type === 'existing') {
      assignEntityToEdge(item.name);
    } else {
      // Quick-create: add entity first, then assign
      const result = useGraphStore.getState().addEntity(canvasId, { name: item.name });
      if (!result.ok && result.error.code !== 'DUPLICATE_ENTITY') {
        return; // Unexpected error — don't assign
      }
      // DUPLICATE_ENTITY is a race condition — entity already exists, still assign
      assignEntityToEdge(item.name);
    }
  };

  const handleEntityKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowEntityInput(false);
      setEntityQuery('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, dropdownItems.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && dropdownItems.length > 0) {
      e.preventDefault();
      selectItem(dropdownItems[highlightIndex]);
    }
  };

  const removeEntity = (name: string) => {
    useGraphStore.getState().updateEdge(canvasId, from, to, {
      entities: entities.filter((e) => e !== name),
    });
  };

  const inputClass = 'w-full border rounded px-1 py-0.5 text-xs';

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: duration.normal, ease: ease.out }}
    >
      {/* Header */}
      <div className="p-3 border-b">
        <h3 className="font-medium text-sm">
          <span className="font-mono">{from}</span>
          <span className="text-gray-400 mx-1">&rarr;</span>
          <span className="font-mono">{to}</span>
        </h3>
        {edge.protocol && (
          <p className="text-xs text-gray-500 mt-0.5">{edge.protocol}</p>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Label */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-0.5">Label</label>
          <input
            className={inputClass}
            value={label}
            placeholder="Optional label"
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => saveField({ label: label || undefined })}
            onKeyDown={(e) => e.key === 'Enter' && saveField({ label: label || undefined })}
          />
        </div>

        {/* Protocol */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-0.5">Protocol</label>
          <input
            className={inputClass}
            value={protocol}
            placeholder="e.g. HTTP, gRPC, Kafka"
            onChange={(e) => setProtocol(e.target.value)}
            onBlur={() => saveField({ protocol: protocol || undefined })}
            onKeyDown={(e) => e.key === 'Enter' && saveField({ protocol: protocol || undefined })}
          />
        </div>

        {/* Entities */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-1">Entities</label>
          {entities.length === 0 && !showEntityInput && (
            <motion.p
              className="text-gray-400 mb-1"
              {...withReducedMotion(prefersReduced, entrance.fadeUp)}
            >
              No entities.
            </motion.p>
          )}
          <div className="flex flex-wrap gap-1 mb-1">
            <AnimatePresence>
              {entities.map((name) => (
                <motion.span
                  key={name}
                  layout
                  initial={prefersReduced ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={prefersReduced ? undefined : { scale: 0.8, opacity: 0 }}
                  transition={{ duration: duration.normal, ease: ease.out }}
                  className="inline-flex items-center gap-0.5 bg-purple-50 text-purple-700 rounded px-1.5 py-0.5 text-[10px]"
                >
                  {name}
                  <button
                    onClick={() => removeEntity(name)}
                    className="text-purple-400 hover:text-purple-700 ml-0.5 leading-none"
                    title="Remove entity"
                  >
                    &times;
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          {showEntityInput ? (
            <div ref={comboboxRef} className="relative">
              <input
                autoFocus
                className="w-full border rounded px-1.5 py-0.5 text-xs"
                placeholder="Search or create entity..."
                value={entityQuery}
                onChange={(e) => setEntityQuery(e.target.value)}
                onKeyDown={handleEntityKeyDown}
              />
              {entityQuery.trim() && dropdownItems.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute z-10 mt-0.5 w-full bg-white dark:bg-gray-800 border rounded shadow-md max-h-40 overflow-auto"
                >
                  {dropdownItems.map((item, i) => (
                    <li
                      key={item.type === 'create' ? `create-${item.name}` : item.name}
                      role="option"
                      aria-selected={i === highlightIndex}
                      className={`px-2 py-1 cursor-pointer text-xs ${
                        i === highlightIndex ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectItem(item)}
                    >
                      {item.type === 'create' ? (
                        <span className="text-blue-600 dark:text-blue-400">Create "{item.name}"</span>
                      ) : (
                        item.name
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowEntityInput(true)}
              className="text-blue-600 hover:underline"
            >
              + Add Entity
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="text-xs">
          <label className="block font-medium text-gray-700 mb-1">Notes</label>
          <NotesTab notes={notes} canvasId={canvasId} from={from} to={to} />
        </div>
      </div>
    </motion.div>
  );
}
