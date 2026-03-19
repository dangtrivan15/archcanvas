import { motion, useReducedMotion } from 'motion/react';
import type { InlineNode } from '@/types';
import type { ArgDef, NodeDef } from '@/types/nodeDefSchema';
import type { PropertyValue } from '@/types/schema';
import { useGraphStore } from '@/store/graphStore';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  node: InlineNode;
  nodeDef: NodeDef | undefined;
  canvasId: string;
}

export function PropertiesTab({ node, nodeDef, canvasId }: Props) {
  const prefersReduced = useReducedMotion();
  const args = node.args ?? {};

  const updateArg = (name: string, value: PropertyValue) => {
    useGraphStore.getState().updateNode(canvasId, node.id, {
      args: { ...args, [name]: value },
    });
  };

  // If no NodeDef, show raw key-value editor
  if (!nodeDef) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-amber-600">Unknown node type — raw args editor</p>
        {Object.entries(args).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-gray-600 w-24 truncate">{key}</span>
            <input
              value={String(val ?? '')}
              onChange={(e) => updateArg(key, e.target.value)}
              className="flex-1 border rounded px-1 py-0.5"
            />
          </div>
        ))}
      </div>
    );
  }

  // Dynamic form from NodeDef args
  const specArgs = nodeDef.spec?.args ?? [];

  return (
    <div className="space-y-3">
      {specArgs.map((arg, index) => (
        <motion.div
          key={arg.name}
          className="text-xs"
          initial={prefersReduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.2), ease: 'easeOut' }}
        >
          <label className="block font-medium text-gray-700 mb-0.5">
            {arg.name}
            {arg.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
          </label>
          {renderArgInput(arg, args[arg.name], (val) => updateArg(arg.name, val))}
          {arg.description && (
            <p className="text-gray-400 mt-0.5">{arg.description}</p>
          )}
        </motion.div>
      ))}
      {specArgs.length === 0 && (
        <p className="text-xs text-gray-400">No configurable properties</p>
      )}
    </div>
  );
}

function renderArgInput(
  arg: ArgDef,
  value: PropertyValue | undefined,
  onChange: (val: PropertyValue) => void,
) {
  const inputClass = 'w-full border rounded px-1 py-0.5 text-xs';

  switch (arg.type) {
    case 'boolean':
      return (
        <Checkbox
          checked={Boolean(value ?? arg.default ?? false)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
          className="mt-0.5"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={String(value ?? arg.default ?? '')}
          onChange={(e) => onChange(Number(e.target.value))}
          className={inputClass}
        />
      );

    case 'enum':
      return (
        <select
          value={String(value ?? arg.default ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {(arg.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'duration':
      return (
        <input
          type="text"
          value={String(value ?? arg.default ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 30s, 5m, 1h"
          className={inputClass}
        />
      );

    case 'string':
    default:
      return (
        <input
          type="text"
          value={String(value ?? arg.default ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
}
