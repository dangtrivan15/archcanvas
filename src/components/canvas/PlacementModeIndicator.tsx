/**
 * PlacementModeIndicator - Status bar shown during node placement mode.
 */

interface PlacementModeIndicatorProps {
  displayName: string;
  onCancel: () => void;
}

export function PlacementModeIndicator({ displayName, onCancel }: PlacementModeIndicatorProps) {
  return (
    <div
      className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
      data-testid="placement-mode-indicator"
    >
      <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
      Click on canvas to place <strong>{displayName}</strong>
      <button
        onClick={onCancel}
        className="ml-2 px-2 py-0.5 bg-blue-500 hover:bg-blue-400 rounded text-xs cursor-pointer"
        data-testid="placement-mode-cancel"
      >
        Esc to cancel
      </button>
    </div>
  );
}
