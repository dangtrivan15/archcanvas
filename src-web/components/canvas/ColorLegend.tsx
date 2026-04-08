import { useUiStore } from '@/store/uiStore';
import { BUILT_IN_NAMESPACES } from '@/core/namespaceColors';

/** Human-readable labels for each namespace */
const NAMESPACE_LABELS: Record<string, string> = {
  compute: 'Compute',
  data: 'Data',
  messaging: 'Messaging',
  network: 'Network',
  client: 'Client',
  integration: 'Integration',
  security: 'Security',
  observability: 'Observability',
  ai: 'AI',
};

/**
 * Floating legend that maps namespace colours to names.
 * Toggled via uiStore.showColorLegend.
 */
export function ColorLegend() {
  const show = useUiStore((s) => s.showColorLegend);
  const toggle = useUiStore((s) => s.toggleColorLegend);

  if (!show) return null;

  return (
    <div
      className="absolute bottom-4 left-4 z-50 rounded-lg border bg-popover p-3 shadow-md text-xs"
      data-testid="color-legend"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-popover-foreground">Namespace Colors</span>
        <button
          onClick={toggle}
          className="text-muted-foreground hover:text-popover-foreground text-base leading-none cursor-pointer"
          aria-label="Close color legend"
        >
          ×
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {BUILT_IN_NAMESPACES.map((ns) => (
          <li key={ns} className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-sm border flex-shrink-0"
              style={{
                backgroundColor: `var(--color-ns-${ns}-bg)`,
                borderColor: `var(--color-ns-${ns}-border)`,
              }}
            />
            <span className="text-popover-foreground">{NAMESPACE_LABELS[ns] ?? ns}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
