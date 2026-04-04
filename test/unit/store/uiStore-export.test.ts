import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/store/uiStore';

describe('uiStore — export dialog', () => {
  beforeEach(() => {
    useUiStore.setState({ showExportDialog: false });
  });

  it('showExportDialog defaults to false', () => {
    expect(useUiStore.getState().showExportDialog).toBe(false);
  });

  it('openExportDialog sets showExportDialog to true', () => {
    useUiStore.getState().openExportDialog();
    expect(useUiStore.getState().showExportDialog).toBe(true);
  });

  it('closeExportDialog sets showExportDialog to false', () => {
    useUiStore.getState().openExportDialog();
    expect(useUiStore.getState().showExportDialog).toBe(true);

    useUiStore.getState().closeExportDialog();
    expect(useUiStore.getState().showExportDialog).toBe(false);
  });

  it('openExportDialog is idempotent', () => {
    useUiStore.getState().openExportDialog();
    useUiStore.getState().openExportDialog();
    expect(useUiStore.getState().showExportDialog).toBe(true);
  });
});
