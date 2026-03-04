/**
 * Unit tests for ModeStatusBar mode derivation logic.
 */

import { describe, it, expect } from 'vitest';
import { deriveCanvasMode } from '@/components/canvas/ModeStatusBar';

describe('deriveCanvasMode', () => {
  it('returns NORMAL when no mode is active', () => {
    expect(deriveCanvasMode({
      connectStep: null,
      connectSource: null,
      inlineEditNodeId: null,
      placementMode: false,
    })).toBe('NORMAL');
  });

  it('returns CONNECT when connectStep is set', () => {
    expect(deriveCanvasMode({
      connectStep: 'select-target',
      connectSource: 'node-1',
      inlineEditNodeId: null,
      placementMode: false,
    })).toBe('CONNECT');
  });

  it('returns CONNECT when connectSource is set (even without step)', () => {
    expect(deriveCanvasMode({
      connectStep: null,
      connectSource: 'node-1',
      inlineEditNodeId: null,
      placementMode: false,
    })).toBe('CONNECT');
  });

  it('returns EDIT when inlineEditNodeId is set', () => {
    expect(deriveCanvasMode({
      connectStep: null,
      connectSource: null,
      inlineEditNodeId: 'node-1',
      placementMode: false,
    })).toBe('EDIT');
  });

  it('returns EDIT when placementMode is active', () => {
    expect(deriveCanvasMode({
      connectStep: null,
      connectSource: null,
      inlineEditNodeId: null,
      placementMode: true,
    })).toBe('EDIT');
  });

  it('CONNECT takes priority over EDIT', () => {
    expect(deriveCanvasMode({
      connectStep: 'select-target',
      connectSource: 'node-1',
      inlineEditNodeId: 'node-1',
      placementMode: true,
    })).toBe('CONNECT');
  });
});
