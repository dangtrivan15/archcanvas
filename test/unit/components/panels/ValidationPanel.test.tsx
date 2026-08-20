import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidationPanel } from '@/components/panels/ValidationPanel';
import { useValidationStore } from '@/store/validationStore';
import { revealNode } from '@/lib/revealNode';
import type { ValidationReport } from '@/core/validation';

vi.mock('@/lib/revealNode', () => ({
  revealNode: vi.fn(),
}));

const mockRunValidation = vi.fn();

vi.mock('@/store/validationStore', () => {
  const state = { report: null as ValidationReport | null, status: 'idle' as const };
  const useValidationStore = vi.fn((selector: (s: typeof state) => unknown) => selector(state));
  (useValidationStore as any).getState = () => ({ ...state, runValidation: mockRunValidation });
  (useValidationStore as any).__setState = (next: Partial<typeof state>) => Object.assign(state, next);
  return { useValidationStore };
});

function setReport(report: ValidationReport | null) {
  (useValidationStore as any).__setState({ report });
}

describe('ValidationPanel', () => {
  beforeEach(() => {
    mockRunValidation.mockClear();
    vi.mocked(revealNode).mockClear();
    setReport(null);
  });

  it('shows an "all clear" state when there is no report or no findings', () => {
    render(<ValidationPanel />);
    expect(screen.getByText(/all clear|no findings|looks clean/i)).toBeTruthy();
    expect(screen.queryAllByTestId('validation-finding')).toHaveLength(0);
  });

  it('renders findings grouped by severity', () => {
    setReport({
      canvasId: '__root__',
      ranAt: 0,
      summary: { critical: 1, warning: 1, info: 1, total: 3 },
      findings: [
        { ruleId: 'public-no-waf-auth', severity: 'critical', title: 'Gateway', message: 'exposed', canvasId: '__root__', nodeId: 'gw-a', source: 'builtin-rule' },
        { ruleId: 'db-no-backup', severity: 'warning', title: 'Database', message: 'no backup', canvasId: '__root__', nodeId: 'db-a', source: 'builtin-rule' },
        { ruleId: 'review-hint', severity: 'info', title: 'Service', message: 'consider rate limiting', canvasId: '__root__', nodeId: 'svc-a', source: 'review-hint' },
      ],
    });
    render(<ValidationPanel />);
    const findings = screen.getAllByTestId('validation-finding');
    expect(findings).toHaveLength(3);
    expect(screen.getByText('exposed')).toBeTruthy();
    expect(screen.getByText('no backup')).toBeTruthy();
    expect(screen.getByText('consider rate limiting')).toBeTruthy();
  });

  it('clicking a finding with a nodeId calls revealNode with its canvasId/nodeId', () => {
    setReport({
      canvasId: 'sub-a',
      ranAt: 0,
      summary: { critical: 0, warning: 0, info: 1, total: 1 },
      findings: [
        { ruleId: 'orphan-node', severity: 'info', title: 'Orphan', message: 'no connections', canvasId: 'sub-a', nodeId: 'node-1', source: 'builtin-rule' },
      ],
    });
    render(<ValidationPanel />);
    fireEvent.click(screen.getByTestId('validation-finding'));
    expect(revealNode).toHaveBeenCalledWith('sub-a', 'node-1');
  });

  it('clicking the Validate button triggers runValidation', () => {
    render(<ValidationPanel />);
    fireEvent.click(screen.getByText('Validate'));
    expect(mockRunValidation).toHaveBeenCalled();
  });
});
