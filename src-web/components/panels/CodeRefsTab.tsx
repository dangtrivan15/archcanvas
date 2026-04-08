import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FileIcon } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { CopyButton } from '@/components/ui/copy-button';
import { duration, ease } from '@/lib/motion';

interface Props {
  codeRefs: string[];
  canvasId: string;
  nodeId: string;
}

export function CodeRefsTab({ codeRefs, canvasId, nodeId }: Props) {
  const prefersReduced = useReducedMotion();
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');

  const save = (updated: string[]) => {
    useGraphStore.getState().updateNode(canvasId, nodeId, { codeRefs: updated });
  };

  const addRef = () => {
    const trimmed = value.trim();
    if (!trimmed || codeRefs.includes(trimmed)) return;
    save([...codeRefs, trimmed]);
    setValue('');
    setShowInput(false);
  };

  const deleteRef = (index: number) => {
    save(codeRefs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {codeRefs.length === 0 && !showInput && (
        <motion.p
          className="text-xs text-gray-400"
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          No code refs yet.
        </motion.p>
      )}

      <AnimatePresence>
        {codeRefs.map((ref, i) => (
          <motion.div
            key={ref}
            layout={!prefersReduced}
            initial={prefersReduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, x: -20 }}
            transition={{ duration: duration.normal, delay: Math.min(i * 0.03, 0.2), ease: ease.out }}
            className="group flex items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-gray-50"
          >
            <FileIcon className="shrink-0 text-gray-400" size={12} />

            <span className="flex-1 font-mono text-gray-700 truncate">
              {ref}
            </span>

            <CopyButton
              content={ref}
              iconSize={10}
              className="shrink-0 text-gray-400 hover:text-blue-600"
              title="Copy path"
            />

            <button
              onClick={() => deleteRef(i)}
              className="hidden group-hover:inline text-gray-400 hover:text-red-600 px-0.5"
              title="Remove"
            >
              &times;
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {showInput && (
          <motion.div
            key="add-ref-input"
            initial={prefersReduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: duration.normal, ease: ease.out }}
            className="flex gap-1 items-center"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

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
