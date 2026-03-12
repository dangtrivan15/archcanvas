import { useState } from 'react';
import { useGraphStore } from '@/store/graphStore';

interface Props {
  codeRefs: string[];
  canvasId: string;
  nodeId: string;
}

export function CodeRefsTab({ codeRefs, canvasId, nodeId }: Props) {
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const save = (updated: string[]) => {
    useGraphStore.getState().updateNode(canvasId, nodeId, { codeRefs: updated });
  };

  const addRef = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    save([...codeRefs, trimmed]);
    setValue('');
    setShowInput(false);
  };

  const deleteRef = (index: number) => {
    save(codeRefs.filter((_, i) => i !== index));
  };

  const copyRef = (ref: string) => {
    navigator.clipboard.writeText(ref).then(() => {
      setCopied(ref);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-1.5">
      {codeRefs.length === 0 && !showInput && (
        <p className="text-xs text-gray-400">No code refs yet.</p>
      )}

      {codeRefs.map((ref, i) => (
        <div
          key={i}
          className="group flex items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-gray-50"
        >
          {/* File icon */}
          <svg
            className="shrink-0 text-gray-400"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>

          <button
            className="flex-1 text-left font-mono text-gray-700 truncate hover:text-blue-600"
            title={copied === ref ? 'Copied!' : 'Click to copy'}
            onClick={() => copyRef(ref)}
          >
            {copied === ref ? '✓ Copied' : ref}
          </button>

          <button
            onClick={() => deleteRef(i)}
            className="hidden group-hover:inline text-gray-400 hover:text-red-600 px-0.5"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}

      {showInput && (
        <div className="flex gap-1 items-center">
          <input
            autoFocus
            className="flex-1 border rounded px-1.5 py-0.5 text-xs font-mono"
            placeholder="src/path/to/file.ts"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRef();
              if (e.key === 'Escape') { setShowInput(false); setValue(''); }
            }}
          />
          <button
            onClick={addRef}
            className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700"
          >
            Add
          </button>
          <button
            onClick={() => { setShowInput(false); setValue(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-1"
          >
            Cancel
          </button>
        </div>
      )}

      {!showInput && (
        <button
          onClick={() => setShowInput(true)}
          className="text-xs text-blue-600 hover:underline mt-1"
        >
          + Add Code Ref
        </button>
      )}
    </div>
  );
}
