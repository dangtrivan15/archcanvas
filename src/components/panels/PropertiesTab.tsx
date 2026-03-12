import type { InlineNode } from '@/types';
import type { ArgDef, NodeDef } from '@/types/nodeDefSchema';
import type { PropertyValue } from '@/types/schema';
import { useGraphStore } from '@/store/graphStore';

interface Props {
  node: InlineNode;
  nodeDef: NodeDef | undefined;
  canvasId: string;
}

export function PropertiesTab({ node, nodeDef, canvasId }: Props) {
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
      {specArgs.map((arg) => (
        <div key={arg.name} className="text-xs">
          <label className="block font-medium text-gray-700 mb-0.5">
            {arg.name}
            {arg.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
          </label>
          {renderArgInput(arg, args[arg.name], (val) => updateArg(arg.name, val))}
          {arg.description && (
            <p className="text-gray-400 mt-0.5">{arg.description}</p>
          )}
        </div>
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
        <input
          type="checkbox"
          checked={Boolean(value ?? arg.default ?? false)}
          onChange={(e) => onChange(e.target.checked)}
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
