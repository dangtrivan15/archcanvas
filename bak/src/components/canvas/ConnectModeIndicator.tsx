/**
 * ConnectModeIndicator - Status bar shown during keyboard-driven edge connection mode.
 */

interface ConnectModeIndicatorProps {
  step: 'select-target' | 'pick-type';
}

export function ConnectModeIndicator({ step }: ConnectModeIndicatorProps) {
  return (
    <div
      className="absolute top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
      data-testid="connect-mode-indicator"
    >
      <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
      {step === 'select-target'
        ? 'CONNECT: Select target (↑↓←→) then Enter | Esc to cancel'
        : 'CONNECT: Pick type — 1=Sync  2=Async  3=Data Flow | Esc to cancel'}
    </div>
  );
}
