/**
 * Tests for draggable panel resize handles.
 * Feature #217: Panel resize handles are draggable
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import {
  LEFT_PANEL_DEFAULT_WIDTH,
  LEFT_PANEL_MIN_WIDTH,
  LEFT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
} from '@/store/uiStore';

describe('Panel Resize Handles - Feature #217', () => {
  beforeEach(() => {
    useUIStore.setState({
      leftPanelOpen: true,
      rightPanelOpen: true,
      leftPanelWidth: LEFT_PANEL_DEFAULT_WIDTH,
      rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
    });
  });

  describe('Panel width constants', () => {
    it('left panel default width is 240px', () => {
      expect(LEFT_PANEL_DEFAULT_WIDTH).toBe(240);
    });

    it('left panel min width is 180px', () => {
      expect(LEFT_PANEL_MIN_WIDTH).toBe(180);
    });

    it('left panel max width is 400px', () => {
      expect(LEFT_PANEL_MAX_WIDTH).toBe(400);
    });

    it('right panel default width is 320px', () => {
      expect(RIGHT_PANEL_DEFAULT_WIDTH).toBe(320);
    });

    it('right panel min width is 220px', () => {
      expect(RIGHT_PANEL_MIN_WIDTH).toBe(220);
    });

    it('right panel max width is 500px', () => {
      expect(RIGHT_PANEL_MAX_WIDTH).toBe(500);
    });
  });

  describe('Left panel width state', () => {
    it('starts at default width', () => {
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_DEFAULT_WIDTH);
    });

    it('setLeftPanelWidth updates width', () => {
      useUIStore.getState().setLeftPanelWidth(300);
      expect(useUIStore.getState().leftPanelWidth).toBe(300);
    });

    it('setLeftPanelWidth clamps to min width', () => {
      useUIStore.getState().setLeftPanelWidth(50);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MIN_WIDTH);
    });

    it('setLeftPanelWidth clamps to max width', () => {
      useUIStore.getState().setLeftPanelWidth(800);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MAX_WIDTH);
    });

    it('setLeftPanelWidth allows value at min boundary', () => {
      useUIStore.getState().setLeftPanelWidth(LEFT_PANEL_MIN_WIDTH);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MIN_WIDTH);
    });

    it('setLeftPanelWidth allows value at max boundary', () => {
      useUIStore.getState().setLeftPanelWidth(LEFT_PANEL_MAX_WIDTH);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MAX_WIDTH);
    });
  });

  describe('Right panel width state', () => {
    it('starts at default width', () => {
      expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_DEFAULT_WIDTH);
    });

    it('setRightPanelWidth updates width', () => {
      useUIStore.getState().setRightPanelWidth(400);
      expect(useUIStore.getState().rightPanelWidth).toBe(400);
    });

    it('setRightPanelWidth clamps to min width', () => {
      useUIStore.getState().setRightPanelWidth(100);
      expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_MIN_WIDTH);
    });

    it('setRightPanelWidth clamps to max width', () => {
      useUIStore.getState().setRightPanelWidth(1000);
      expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_MAX_WIDTH);
    });

    it('setRightPanelWidth allows value at min boundary', () => {
      useUIStore.getState().setRightPanelWidth(RIGHT_PANEL_MIN_WIDTH);
      expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_MIN_WIDTH);
    });

    it('setRightPanelWidth allows value at max boundary', () => {
      useUIStore.getState().setRightPanelWidth(RIGHT_PANEL_MAX_WIDTH);
      expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_MAX_WIDTH);
    });
  });

  describe('Width independence', () => {
    it('left panel width is independent of right panel width', () => {
      useUIStore.getState().setLeftPanelWidth(300);
      expect(useUIStore.getState().leftPanelWidth).toBe(300);
      expect(useUIStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_DEFAULT_WIDTH);
    });

    it('right panel width is independent of left panel width', () => {
      useUIStore.getState().setRightPanelWidth(400);
      expect(useUIStore.getState().rightPanelWidth).toBe(400);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_DEFAULT_WIDTH);
    });

    it('panel visibility does not reset width', () => {
      useUIStore.getState().setLeftPanelWidth(300);
      useUIStore.getState().toggleLeftPanel(); // close
      expect(useUIStore.getState().leftPanelWidth).toBe(300);
      useUIStore.getState().toggleLeftPanel(); // reopen
      expect(useUIStore.getState().leftPanelWidth).toBe(300);
    });
  });

  describe('Sequential resizes', () => {
    it('supports incremental left panel resize', () => {
      // Simulate drag: start at default, drag 20px right, then 30px more
      useUIStore.getState().setLeftPanelWidth(LEFT_PANEL_DEFAULT_WIDTH + 20);
      expect(useUIStore.getState().leftPanelWidth).toBe(260);
      useUIStore.getState().setLeftPanelWidth(260 + 30);
      expect(useUIStore.getState().leftPanelWidth).toBe(290);
    });

    it('supports incremental right panel resize', () => {
      useUIStore.getState().setRightPanelWidth(RIGHT_PANEL_DEFAULT_WIDTH + 40);
      expect(useUIStore.getState().rightPanelWidth).toBe(360);
      useUIStore.getState().setRightPanelWidth(360 + 20);
      expect(useUIStore.getState().rightPanelWidth).toBe(380);
    });

    it('clamping applies at each step', () => {
      // Drag past max
      useUIStore.getState().setLeftPanelWidth(LEFT_PANEL_MAX_WIDTH + 100);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MAX_WIDTH);
      // Try to drag further - stays at max
      useUIStore.getState().setLeftPanelWidth(LEFT_PANEL_MAX_WIDTH + 200);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MAX_WIDTH);
    });
  });
});
