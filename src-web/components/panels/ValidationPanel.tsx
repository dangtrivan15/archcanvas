import { AlertTriangle, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import { useValidationStore } from '@/store/validationStore';
import { revealNode } from '@/lib/revealNode';
import type { Severity, ValidationFinding } from '@/core/validation';

const SEVERITY_ORDER: Severity[] = ['critical', 'warning', 'info'];

const SEVERITY_CONFIG: Record<Severity, { label: string; tint: string; icon: typeof AlertTriangle }> = {
  critical: { label: 'Critical', tint: 'bg-red-500/15 text-red-500', icon: AlertTriangle },
  warning: { label: 'Warning', tint: 'bg-amber-500/15 text-amber-500', icon: AlertTriangle },
  info: { label: 'Info', tint: 'bg-sky-500/15 text-sky-500', icon: Info },
};

function groupBySeverity(findings: ValidationFinding[]): Record<Severity, ValidationFinding[]> {
  const groups: Record<Severity, ValidationFinding[]> = { critical: [], warning: [], info: [] };
  for (const f of findings) groups[f.severity].push(f);
  return groups;
}

function FindingRow({ finding }: { finding: ValidationFinding }) {
  const { tint, icon: Icon } = SEVERITY_CONFIG[finding.severity];
  const clickable = finding.nodeId !== undefined;

  return (
    <div
      data-testid="validation-finding"
      onClick={clickable ? () => revealNode(finding.canvasId, finding.nodeId!) : undefined}
      className={`flex items-start gap-2 rounded p-2 text-xs ${clickable ? 'cursor-pointer hover:bg-accent/50' : ''}`}
    >
      <span className={`mt-0.5 flex-none rounded p-1 ${tint}`}>
        <Icon className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{finding.title}</div>
        <div className="mt-0.5 text-muted-foreground">{finding.message}</div>
        {finding.suggestion && (
          <div className="mt-1 text-muted-foreground/80 italic">{finding.suggestion}</div>
        )}
      </div>
    </div>
  );
}

export function ValidationPanel() {
  const report = useValidationStore((s) => s.report);
  const status = useValidationStore((s) => s.status);

  const findings = report?.findings ?? [];
  const groups = groupBySeverity(findings);
  const hasFindings = findings.length > 0;

  return (
    <div className="flex h-full flex-col" data-testid="validation-panel">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-medium text-foreground">Validation</h3>
        <button
          onClick={() => useValidationStore.getState().runValidation()}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <RefreshCw className={`size-3 ${status === 'running' ? 'animate-spin' : ''}`} />
          Validate
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!hasFindings ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-8 text-emerald-500" />
            <p>No findings — architecture looks clean.</p>
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {SEVERITY_ORDER.filter((s) => groups[s].length > 0).map((severity) => (
              <div key={severity}>
                <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {SEVERITY_CONFIG[severity].label} ({groups[severity].length})
                </div>
                <div className="space-y-0.5">
                  {groups[severity].map((finding, idx) => (
                    <FindingRow key={`${finding.ruleId}-${finding.nodeId ?? 'none'}-${idx}`} finding={finding} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
