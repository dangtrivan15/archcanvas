/**
 * DropZoneOverlay - Visual feedback when dragging files over the canvas.
 */

export function DropZoneOverlay() {
  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
      data-testid="drop-zone-overlay"
      style={{
        backgroundColor: 'hsla(var(--pine), 0.08)',
        border: '3px dashed hsl(var(--pine))',
        borderRadius: '12px',
      }}
    >
      <div
        className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl"
        style={{
          backgroundColor: 'hsl(var(--surface))',
          boxShadow: '0 8px 32px hsla(0, 0%, 0%, 0.2)',
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(var(--pine))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="text-sm font-medium" style={{ color: 'hsl(var(--text))' }}>
          Drop .archc file to open
        </span>
        <span className="text-xs" style={{ color: 'hsl(var(--subtle))' }}>
          or drop an image to attach
        </span>
      </div>
    </div>
  );
}
