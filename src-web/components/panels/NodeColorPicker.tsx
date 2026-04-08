import { useState, useCallback } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/Button';
import { useGraphStore } from '@/store/graphStore';

interface Props {
  canvasId: string;
  nodeId: string;
  currentColor: string | undefined;
}

/** Preset colour swatches — a curated palette of distinguishable pastel/muted hues */
const PRESET_SWATCHES = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
] as const;

export function NodeColorPicker({ canvasId, nodeId, currentColor }: Props) {
  const [customColor, setCustomColor] = useState(currentColor ?? '#3b82f6');

  const applyColor = useCallback(
    (color: string | undefined) => {
      useGraphStore.getState().updateNode(canvasId, nodeId, { color });
    },
    [canvasId, nodeId],
  );

  const handleReset = useCallback(() => {
    applyColor(undefined);
  }, [applyColor]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 cursor-pointer flex-shrink-0"
          style={{ backgroundColor: currentColor ?? 'var(--color-node-bg)' }}
          title="Node color"
          aria-label="Change node color"
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" side="bottom" align="start">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Node Color
          </span>

          {/* Preset swatches */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SWATCHES.map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded-sm border cursor-pointer transition-transform hover:scale-110 ${
                  currentColor === color
                    ? 'ring-2 ring-blue-500 ring-offset-1'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => applyColor(color)}
                title={color}
                aria-label={`Set color to ${color}`}
              />
            ))}
          </div>

          {/* Custom color input */}
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border-0 p-0"
              title="Pick custom color"
            />
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              onClick={() => applyColor(customColor)}
            >
              Apply
            </button>
          </div>

          {/* Reset button */}
          {currentColor && (
            <Button variant="ghost" size="xs" onClick={handleReset} className="self-start mt-1">
              Reset to default
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
