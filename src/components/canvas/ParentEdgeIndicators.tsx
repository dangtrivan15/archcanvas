/**
 * ParentEdgeIndicators - Renders clickable "portal" indicators at canvas borders
 * when the user is inside a nested canvas.
 *
 * Each indicator represents a parent edge that connects to the container node,
 * showing the connected node's name, edge type, and direction. Clicking an
 * indicator navigates back to the parent canvas and centers on the connected node.
 *
 * Indicators are rendered as a fixed-position overlay that doesn't move with
 * canvas pan/zoom.
 */

import React, { useCallback, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Zap, Database, RefreshCw } from 'lucide-react';
import { useNavigationStore, type ParentEdgeIndicator } from '@/store/navigationStore';
import { useCanvasStore } from '@/store/canvasStore';

// ─── Edge type styling ──────────────────────────────────────────

const EDGE_TYPE_CONFIG = {
  sync: { icon: RefreshCw, label: 'Sync', color: '#3B82F6' },
  async: { icon: Zap, label: 'Async', color: '#F59E0B' },
  'data-flow': { icon: Database, label: 'Data', color: '#10B981' },
} as const;

// ─── Individual Indicator Pill ──────────────────────────────────

interface IndicatorPillProps {
  indicator: ParentEdgeIndicator;
  onNavigate: (connectedNodeId: string) => void;
}

const IndicatorPill = React.memo(function IndicatorPill({
  indicator,
  onNavigate,
}: IndicatorPillProps) {
  const { edge, connectedNodeName, connectedNodeId, direction } = indicator;
  const config = EDGE_TYPE_CONFIG[edge.type] || EDGE_TYPE_CONFIG.sync;
  const EdgeIcon = config.icon;
  const DirectionIcon = direction === 'incoming' ? ArrowRight : ArrowLeft;

  const handleClick = useCallback(() => {
    onNavigate(connectedNodeId);
  }, [connectedNodeId, onNavigate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate(connectedNodeId);
      }
    },
    [connectedNodeId, onNavigate],
  );

  // Truncate long names
  const displayName =
    connectedNodeName.length > 20
      ? connectedNodeName.slice(0, 18) + '\u2026'
      : connectedNodeName;

  return (
    <button
      className="parent-edge-indicator flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 text-xs font-medium shadow-md cursor-pointer transition-all duration-150
                 hover:scale-105 hover:shadow-lg focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      style={{
        backgroundColor: 'hsl(var(--surface))',
        color: 'hsl(var(--text))',
        border: `2px solid ${config.color}`,
        backdropFilter: 'blur(8px)',
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-testid={`parent-edge-indicator-${edge.id}`}
      data-edge-id={edge.id}
      data-direction={direction}
      title={`${direction === 'incoming' ? 'From' : 'To'}: ${connectedNodeName} (${config.label}) - Click to navigate`}
      aria-label={`Navigate to ${connectedNodeName} in parent canvas`}
      role="button"
      tabIndex={0}
    >
      {direction === 'incoming' && (
        <DirectionIcon size={12} style={{ color: config.color }} aria-hidden />
      )}
      <EdgeIcon size={12} style={{ color: config.color }} aria-hidden />
      <span className="max-w-[120px] truncate">{displayName}</span>
      {edge.label && (
        <span className="opacity-60 text-[10px]">({edge.label})</span>
      )}
      {direction === 'outgoing' && (
        <DirectionIcon size={12} style={{ color: config.color }} aria-hidden />
      )}
    </button>
  );
});

// ─── Main Component ─────────────────────────────────────────────

export const ParentEdgeIndicators = React.memo(function ParentEdgeIndicators() {
  const parentEdgeIndicators = useNavigationStore((s) => s.parentEdgeIndicators);
  const popFile = useNavigationStore((s) => s.popFile);
  const requestCenterOnNode = useCanvasStore((s) => s.requestCenterOnNode);
  const depth = useNavigationStore((s) => s.fileStack.length);

  // Split indicators by direction for positioning
  const { incoming, outgoing } = useMemo(() => {
    const inc: ParentEdgeIndicator[] = [];
    const out: ParentEdgeIndicator[] = [];
    for (const ind of parentEdgeIndicators) {
      if (ind.direction === 'incoming') inc.push(ind);
      else out.push(ind);
    }
    return { incoming: inc, outgoing: out };
  }, [parentEdgeIndicators]);

  // Navigate back to parent and center on the connected node
  const handleNavigate = useCallback(
    (connectedNodeId: string) => {
      // Pop back to parent canvas
      popFile();
      // After a brief delay (to let React Flow render), center on the connected node
      // Use requestAnimationFrame to ensure the graph has been restored
      requestAnimationFrame(() => {
        requestCenterOnNode(connectedNodeId);
      });
    },
    [popFile, requestCenterOnNode],
  );

  // Don't render if not nested or no indicators
  if (depth === 0 || parentEdgeIndicators.length === 0) return null;

  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none"
      data-testid="parent-edge-indicators"
      aria-label="Parent edge indicators"
    >
      {/* Incoming edges - left border */}
      {incoming.length > 0 && (
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto"
          data-testid="parent-edge-indicators-incoming"
        >
          {incoming.map((ind) => (
            <IndicatorPill
              key={ind.edge.id}
              indicator={ind}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}

      {/* Outgoing edges - right border */}
      {outgoing.length > 0 && (
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto"
          data-testid="parent-edge-indicators-outgoing"
        >
          {outgoing.map((ind) => (
            <IndicatorPill
              key={ind.edge.id}
              indicator={ind}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
});
