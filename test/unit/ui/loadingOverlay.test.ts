/**
 * Tests for Feature #196: Large file operation shows loading indicator.
 * Verifies the loading overlay state and component behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';

describe('Feature #196: Loading indicator for file operations', () => {
  beforeEach(() => {
    // Reset loading state
    useUIStore.setState({
      fileOperationLoading: false,
      fileOperationMessage: null,
    });
  });

  it('loading state starts as false', () => {
    const state = useUIStore.getState();
    expect(state.fileOperationLoading).toBe(false);
    expect(state.fileOperationMessage).toBeNull();
  });

  it('setFileOperationLoading sets loading state with message', () => {
    useUIStore.getState().setFileOperationLoading('Opening file...');

    const state = useUIStore.getState();
    expect(state.fileOperationLoading).toBe(true);
    expect(state.fileOperationMessage).toBe('Opening file...');
  });

  it('clearFileOperationLoading clears loading state', () => {
    useUIStore.getState().setFileOperationLoading('Saving file...');
    expect(useUIStore.getState().fileOperationLoading).toBe(true);

    useUIStore.getState().clearFileOperationLoading();

    const state = useUIStore.getState();
    expect(state.fileOperationLoading).toBe(false);
    expect(state.fileOperationMessage).toBeNull();
  });

  it('setFileOperationLoading can be called with different messages', () => {
    useUIStore.getState().setFileOperationLoading('Opening file...');
    expect(useUIStore.getState().fileOperationMessage).toBe('Opening file...');

    useUIStore.getState().setFileOperationLoading('Saving file...');
    expect(useUIStore.getState().fileOperationMessage).toBe('Saving file...');

    useUIStore.getState().setFileOperationLoading('Loading file...');
    expect(useUIStore.getState().fileOperationMessage).toBe('Loading file...');
  });

  it('loading state does not interfere with other UI state', () => {
    const initialState = useUIStore.getState();
    const initialLeftPanel = initialState.leftPanelOpen;
    const initialRightPanel = initialState.rightPanelOpen;

    useUIStore.getState().setFileOperationLoading('Opening file...');

    const afterLoading = useUIStore.getState();
    expect(afterLoading.leftPanelOpen).toBe(initialLeftPanel);
    expect(afterLoading.rightPanelOpen).toBe(initialRightPanel);
    expect(afterLoading.fileOperationLoading).toBe(true);
  });

  it('clearFileOperationLoading does not interfere with other UI state', () => {
    useUIStore.getState().setFileOperationLoading('Test');
    useUIStore.getState().toggleLeftPanel(); // Flip left panel

    const before = useUIStore.getState();
    const leftPanelBefore = before.leftPanelOpen;

    useUIStore.getState().clearFileOperationLoading();

    const after = useUIStore.getState();
    expect(after.leftPanelOpen).toBe(leftPanelBefore);
    expect(after.fileOperationLoading).toBe(false);
    expect(after.fileOperationMessage).toBeNull();
  });
});
