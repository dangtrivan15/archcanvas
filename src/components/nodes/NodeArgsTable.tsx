/**
 * NodeArgsTable - Displays node arguments in a clean, aligned two-column table layout.
 * Shows up to `maxRows` key-value pairs with a "+N more" indicator if truncated.
 */
import React from 'react';

interface NodeArgsTableProps {
  args: Record<string, unknown>;
  /** Maximum number of argument rows to display before truncating */
  maxRows?: number;
  /** Additional CSS classes for the outer container */
  className?: string;
  /** Center-align text (used by shape nodes like cloud, hexagon, etc.) */
  centered?: boolean;
}

export const NodeArgsTable: React.FC<NodeArgsTableProps> = ({
  args,
  maxRows = 3,
  className = '',
  centered = false,
}) => {
  const entries = Object.entries(args);
  if (entries.length === 0) return null;

  const visible = entries.slice(0, maxRows);
  const remaining = entries.length - maxRows;

  return (
    <div className={`text-xs text-subtle ${className}`} data-testid="node-args-table">
      <table className={`w-full border-collapse ${centered ? 'mx-auto' : ''}`}>
        <tbody>
          {visible.map(([key, value]) => (
            <tr key={key} className="leading-5">
              <td
                className="text-muted-foreground font-mono pr-2 text-right align-top whitespace-nowrap"
                style={{ width: '1%' }}
              >
                {key}
              </td>
              <td className="text-left truncate max-w-[120px]">{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {remaining > 0 && (
        <div
          className={`text-[10px] text-muted-foreground mt-0.5 ${centered ? 'text-center' : ''}`}
          data-testid="node-args-more"
        >
          +{remaining} more
        </div>
      )}
    </div>
  );
};
