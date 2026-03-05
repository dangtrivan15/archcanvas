/**
 * PencilIndicator — Shows Apple Pencil status in the toolbar.
 *
 * Displays a pen icon when an Apple Pencil / stylus has been detected.
 * When the pencil is actively in contact, the icon pulses and shows
 * a pressure indicator tooltip.
 *
 * Only visible after a pencil has been detected in the current session.
 */

import { Pen } from 'lucide-react';
import { usePencilStore } from '@/store/pencilStore';

interface PencilIndicatorProps {
  compact?: boolean;
}

export function PencilIndicator({ compact }: PencilIndicatorProps) {
  const pencilDetected = usePencilStore((s) => s.pencilDetected);
  const isPencilActive = usePencilStore((s) => s.isPencilActive);
  const pressure = usePencilStore((s) => s.pressure);

  // Only show when a pencil has been detected
  if (!pencilDetected) return null;

  const pressurePercent = Math.round(pressure * 100);
  const title = isPencilActive
    ? `Apple Pencil active — Pressure: ${pressurePercent}%`
    : 'Apple Pencil detected';

  return (
    <div
      className={`inline-flex items-center justify-center gap-1 text-sm font-medium rounded-md transition-colors ${
        isPencilActive ? 'text-primary' : 'text-muted-foreground'
      } ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'}`}
      title={title}
      aria-label={title}
      data-testid="pencil-indicator"
      role="status"
    >
      <Pen
        className={`w-4 h-4 transition-opacity ${
          isPencilActive ? 'opacity-100 animate-pulse' : 'opacity-60'
        }`}
      />
      {!compact && isPencilActive && (
        <span className="text-xs tabular-nums" data-testid="pencil-pressure">
          {pressurePercent}%
        </span>
      )}
    </div>
  );
}
