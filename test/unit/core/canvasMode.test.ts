/**
 * Unit tests for the Vim-style Canvas Mode system.
 * Tests CanvasMode enum, transitions, display metadata, action filtering,
 * and uiStore mode state management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CanvasMode,
  isValidTransition,
  getValidTargets,
  MODE_TRANSITIONS,
  MODE_DISPLAY,
  getModeActionPrefix,
  isActionAvailableInMode,
} from '@/core/input/canvasMode';
import { useUIStore } from '@/store/uiStore';

describe('CanvasMode enum', () => {
  it('has three modes: Normal, Connect, Edit', () => {
    expect(CanvasMode.Normal).toBe('NORMAL');
    expect(CanvasMode.Connect).toBe('CONNECT');
    expect(CanvasMode.Edit).toBe('EDIT');
  });

  it('enum values are unique', () => {
    const values = Object.values(CanvasMode);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('Mode transitions', () => {
  it('Normal → Connect is valid', () => {
    expect(isValidTransition(CanvasMode.Normal, CanvasMode.Connect)).toBe(true);
  });

  it('Normal → Edit is valid', () => {
    expect(isValidTransition(CanvasMode.Normal, CanvasMode.Edit)).toBe(true);
  });

  it('Connect → Normal is valid', () => {
    expect(isValidTransition(CanvasMode.Connect, CanvasMode.Normal)).toBe(true);
  });

  it('Edit → Normal is valid', () => {
    expect(isValidTransition(CanvasMode.Edit, CanvasMode.Normal)).toBe(true);
  });

  it('Connect → Edit is NOT valid (must go through Normal)', () => {
    expect(isValidTransition(CanvasMode.Connect, CanvasMode.Edit)).toBe(false);
  });

  it('Edit → Connect is NOT valid (must go through Normal)', () => {
    expect(isValidTransition(CanvasMode.Edit, CanvasMode.Connect)).toBe(false);
  });

  it('same mode → same mode is NOT valid', () => {
    expect(isValidTransition(CanvasMode.Normal, CanvasMode.Normal)).toBe(false);
    expect(isValidTransition(CanvasMode.Connect, CanvasMode.Connect)).toBe(false);
    expect(isValidTransition(CanvasMode.Edit, CanvasMode.Edit)).toBe(false);
  });

  it('getValidTargets from Normal returns Connect and Edit', () => {
    const targets = getValidTargets(CanvasMode.Normal);
    expect(targets).toContain(CanvasMode.Connect);
    expect(targets).toContain(CanvasMode.Edit);
  });

  it('getValidTargets from Connect returns only Normal', () => {
    const targets = getValidTargets(CanvasMode.Connect);
    expect(targets).toEqual([CanvasMode.Normal]);
  });

  it('getValidTargets from Edit returns only Normal', () => {
    const targets = getValidTargets(CanvasMode.Edit);
    expect(targets).toEqual([CanvasMode.Normal]);
  });

  it('MODE_TRANSITIONS has exactly 5 entries', () => {
    expect(MODE_TRANSITIONS).toHaveLength(5);
  });

  it('all transitions have trigger keys', () => {
    for (const t of MODE_TRANSITIONS) {
      expect(t.trigger).toBeTruthy();
    }
  });
});

describe('Mode display metadata', () => {
  it('Normal mode has label "-- NORMAL --"', () => {
    expect(MODE_DISPLAY[CanvasMode.Normal].label).toBe('-- NORMAL --');
  });

  it('Connect mode has label "-- CONNECT --"', () => {
    expect(MODE_DISPLAY[CanvasMode.Connect].label).toBe('-- CONNECT --');
  });

  it('Edit mode has label "-- EDIT --"', () => {
    expect(MODE_DISPLAY[CanvasMode.Edit].label).toBe('-- EDIT --');
  });

  it('Normal mode has no canvas tint', () => {
    expect(MODE_DISPLAY[CanvasMode.Normal].canvasTint).toBe('');
  });

  it('Connect mode has blue canvas tint', () => {
    expect(MODE_DISPLAY[CanvasMode.Connect].canvasTint).toContain('blue');
  });

  it('Edit mode has amber canvas tint', () => {
    expect(MODE_DISPLAY[CanvasMode.Edit].canvasTint).toContain('amber');
  });

  it('all modes have shortLabel', () => {
    expect(MODE_DISPLAY[CanvasMode.Normal].shortLabel).toBe('NORMAL');
    expect(MODE_DISPLAY[CanvasMode.Connect].shortLabel).toBe('CONNECT');
    expect(MODE_DISPLAY[CanvasMode.Edit].shortLabel).toBe('EDIT');
  });

  it('all modes have color classes', () => {
    for (const mode of Object.values(CanvasMode)) {
      const display = MODE_DISPLAY[mode];
      expect(display.color).toBeTruthy();
      expect(display.bgColor).toBeTruthy();
      expect(display.borderColor).toBeTruthy();
    }
  });
});

describe('Mode action prefixes', () => {
  it('Normal mode prefix is "normal:"', () => {
    expect(getModeActionPrefix(CanvasMode.Normal)).toBe('normal:');
  });

  it('Connect mode prefix is "connect:"', () => {
    expect(getModeActionPrefix(CanvasMode.Connect)).toBe('connect:');
  });

  it('Edit mode prefix is "edit:"', () => {
    expect(getModeActionPrefix(CanvasMode.Edit)).toBe('edit:');
  });
});

describe('Action availability filtering', () => {
  it('global actions (no mode prefix) are available in all modes', () => {
    const globalActions = ['file:save', 'canvas:command-palette', 'view:zoom-in'];
    for (const action of globalActions) {
      expect(isActionAvailableInMode(action, CanvasMode.Normal)).toBe(true);
      expect(isActionAvailableInMode(action, CanvasMode.Connect)).toBe(true);
      expect(isActionAvailableInMode(action, CanvasMode.Edit)).toBe(true);
    }
  });

  it('normal:* actions only available in Normal mode', () => {
    expect(isActionAvailableInMode('normal:enter-connect', CanvasMode.Normal)).toBe(true);
    expect(isActionAvailableInMode('normal:enter-connect', CanvasMode.Connect)).toBe(false);
    expect(isActionAvailableInMode('normal:enter-connect', CanvasMode.Edit)).toBe(false);
  });

  it('connect:* actions only available in Connect mode', () => {
    expect(isActionAvailableInMode('connect:exit', CanvasMode.Normal)).toBe(false);
    expect(isActionAvailableInMode('connect:exit', CanvasMode.Connect)).toBe(true);
    expect(isActionAvailableInMode('connect:exit', CanvasMode.Edit)).toBe(false);
  });

  it('edit:* actions only available in Edit mode', () => {
    expect(isActionAvailableInMode('edit:exit', CanvasMode.Normal)).toBe(false);
    expect(isActionAvailableInMode('edit:exit', CanvasMode.Connect)).toBe(false);
    expect(isActionAvailableInMode('edit:exit', CanvasMode.Edit)).toBe(true);
  });
});

describe('uiStore canvas mode state', () => {
  beforeEach(() => {
    // Reset store to defaults
    useUIStore.setState({
      canvasMode: CanvasMode.Normal,
      previousCanvasMode: CanvasMode.Normal,
    });
  });

  it('starts in Normal mode', () => {
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Normal);
  });

  it('previousCanvasMode starts as Normal', () => {
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Normal);
  });

  it('enterMode transitions from Normal to Connect', () => {
    useUIStore.getState().enterMode(CanvasMode.Connect);
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Connect);
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Normal);
  });

  it('enterMode transitions from Normal to Edit', () => {
    useUIStore.getState().enterMode(CanvasMode.Edit);
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Edit);
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Normal);
  });

  it('exitToNormal transitions back to Normal from Connect', () => {
    useUIStore.getState().enterMode(CanvasMode.Connect);
    useUIStore.getState().exitToNormal();
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Normal);
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Connect);
  });

  it('exitToNormal transitions back to Normal from Edit', () => {
    useUIStore.getState().enterMode(CanvasMode.Edit);
    useUIStore.getState().exitToNormal();
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Normal);
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Edit);
  });

  it('rejects invalid transition from Connect to Edit', () => {
    useUIStore.getState().enterMode(CanvasMode.Connect);
    // Attempt invalid transition
    useUIStore.getState().enterMode(CanvasMode.Edit);
    // Should still be in Connect (transition rejected)
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Connect);
  });

  it('rejects invalid transition from Edit to Connect', () => {
    useUIStore.getState().enterMode(CanvasMode.Edit);
    useUIStore.getState().enterMode(CanvasMode.Connect);
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Edit);
  });

  it('getCanvasMode returns current mode', () => {
    expect(useUIStore.getState().getCanvasMode()).toBe(CanvasMode.Normal);
    useUIStore.getState().enterMode(CanvasMode.Connect);
    expect(useUIStore.getState().getCanvasMode()).toBe(CanvasMode.Connect);
  });

  it('multiple mode transitions track previous correctly', () => {
    useUIStore.getState().enterMode(CanvasMode.Connect);
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Normal);

    useUIStore.getState().exitToNormal();
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Connect);

    useUIStore.getState().enterMode(CanvasMode.Edit);
    expect(useUIStore.getState().previousCanvasMode).toBe(CanvasMode.Normal);
  });

  it('exitToNormal when already Normal stays Normal', () => {
    useUIStore.getState().exitToNormal();
    expect(useUIStore.getState().canvasMode).toBe(CanvasMode.Normal);
  });
});
