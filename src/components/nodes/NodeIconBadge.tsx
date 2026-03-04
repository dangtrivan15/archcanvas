import React, { useMemo } from 'react';
import { getContrastColor } from '@/utils/nodeColors';

interface NodeIconBadgeProps {
  icon: React.ElementType;
  color: string;
  'data-testid'?: string;
}

/**
 * Renders a node type icon inside a colored circle badge.
 * The badge uses the node's accent color as background with an automatically
 * contrast-adjusted icon color (white for dark backgrounds, dark for light backgrounds).
 * Sized at 24px (w-6 h-6) to serve as a strong visual anchor.
 */
export function NodeIconBadge({ icon: Icon, color, 'data-testid': testId }: NodeIconBadgeProps) {
  const iconColor = useMemo(() => getContrastColor(color), [color]);

  return (
    <div
      className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
      style={{ backgroundColor: color }}
      data-testid={testId}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
    </div>
  );
}
