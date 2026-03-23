import { describe, it, expect, beforeEach } from 'vitest';
import { useUpdaterStore } from '@/store/updaterStore';

describe('updaterStore', () => {
  beforeEach(() => {
    useUpdaterStore.setState({
      status: 'idle',
      version: null,
      error: null,
    });
  });

  it('starts in idle state', () => {
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('idle');
    expect(state.version).toBeNull();
    expect(state.error).toBeNull();
  });

  it('transitions to checking', () => {
    useUpdaterStore.getState().setStatus('checking');
    expect(useUpdaterStore.getState().status).toBe('checking');
  });

  it('transitions to update-available with version', () => {
    useUpdaterStore.getState().setUpdateAvailable('1.2.3');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('update-available');
    expect(state.version).toBe('1.2.3');
  });

  it('transitions to downloading', () => {
    useUpdaterStore.getState().setStatus('downloading');
    expect(useUpdaterStore.getState().status).toBe('downloading');
  });

  it('transitions to ready-to-restart', () => {
    useUpdaterStore.getState().setStatus('ready-to-restart');
    expect(useUpdaterStore.getState().status).toBe('ready-to-restart');
  });

  it('transitions to error with message', () => {
    useUpdaterStore.getState().setError('Network failed');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network failed');
  });

  it('resets to idle', () => {
    useUpdaterStore.getState().setUpdateAvailable('1.0.0');
    useUpdaterStore.getState().reset();
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('idle');
    expect(state.version).toBeNull();
    expect(state.error).toBeNull();
  });
});
