import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDiffStore } from '@/store/diffStore';
import { useNavigationStore } from '@/store/navigationStore';
import type { PropertyDiff } from '@/core/diff/types';

interface DiffTooltipProps {
  nodeId: string;
  children: ReactNode;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '(none)';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function PropertyDiffLine({ prop }: { prop: PropertyDiff }) {
  return (
    <div className="flex items-start gap-1 text-[10px] leading-tight">
      <span className="shrink-0 font-mono">
        {prop.status === 'added' && <span className="text-green-400">+</span>}
        {prop.status === 'removed' && <span className="text-red-400">−</span>}
        {prop.status === 'modified' && <span className="text-yellow-400">~</span>}
      </span>
      <span className="font-semibold">{prop.key}:</span>
      {prop.status === 'modified' ? (
        <span>
          <span className="text-red-400 line-through">{formatValue(prop.oldValue)}</span>
          {' → '}
          <span className="text-green-400">{formatValue(prop.newValue)}</span>
        </span>
      ) : prop.status === 'added' ? (
        <span className="text-green-400">{formatValue(prop.newValue)}</span>
      ) : (
        <span className="text-red-400">{formatValue(prop.oldValue)}</span>
      )}
    </div>
  );
}

export function DiffTooltip({ nodeId, children }: DiffTooltipProps) {
  const canvasId = useNavigationStore((s) => s.currentCanvasId);
  const nodeDiff = useDiffStore((s) => s.canvasDiffs.get(canvasId)?.nodes.get(nodeId));

  if (!nodeDiff || nodeDiff.properties.length === 0) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-xs bg-popover border border-border shadow-lg rounded-md p-2"
      >
        <div className="text-[11px] font-semibold mb-1 text-popover-foreground">
          {nodeDiff.status === 'modified' ? 'Changed properties' : nodeDiff.status === 'added' ? 'New node' : 'Removed node'}
        </div>
        <div className="flex flex-col gap-0.5">
          {nodeDiff.properties.slice(0, 8).map((prop) => (
            <PropertyDiffLine key={prop.key} prop={prop} />
          ))}
          {nodeDiff.properties.length > 8 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              +{nodeDiff.properties.length - 8} more changes
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
