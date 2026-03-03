/**
 * Tests for left panel full collapse behavior.
 * Feature #218: Left panel collapses fully
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import {
  LEFT_PANEL_DEFAULT_WIDTH,
  LEFT_PANEL_MIN_WIDTH,
  LEFT_PANEL_COLLAPSE_THRESHOLD,
} from '@/store/uiStore';

describe('Left Panel Collapse - Feature #218', () => {
  beforeEach(() => {
    useUIStore.setState({
      leftPanelOpen: true,
      leftPanelWidth: LEFT_PANEL_DEFAULT_WIDTH,
    });
  });

  describe('Collapse threshold constant', () => {
    it('LEFT_PANEL_COLLAPSE_THRESHOLD is 120px', () => {
      expect(LEFT_PANEL_COLLAPSE_THRESHOLD).toBe(120);
    });

    it('collapse threshold is below minimum width', () => {
      expect(LEFT_PANEL_COLLAPSE_THRESHOLD).toBeLessThan(LEFT_PANEL_MIN_WIDTH);
    });

    it('collapse threshold is positive', () => {
      expect(LEFT_PANEL_COLLAPSE_THRESHOLD).toBeGreaterThan(0);
    });
  });

  describe('Toggle left panel', () => {
    it('toggleLeftPanel closes when open', () => {
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
      useUIStore.getState().toggleLeftPanel();
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
    });

    it('toggleLeftPanel opens when closed', () => {
      useUIStore.setState({ leftPanelOpen: false });
      useUIStore.getState().toggleLeftPanel();
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
    });

    it('closing preserves panel width for restore', () => {
      useUIStore.getState().setLeftPanelWidth(300);
      useUIStore.getState().toggleLeftPanel(); // close
      expect(useUIStore.getState().leftPanelWidth).toBe(300);
    });

    it('reopening restores previous width', () => {
      useUIStore.getState().setLeftPanelWidth(300);
      useUIStore.getState().toggleLeftPanel(); // close
      useUIStore.getState().toggleLeftPanel(); // reopen
      expect(useUIStore.getState().leftPanelWidth).toBe(300);
    });
  });

  describe('Collapse/expand cycle', () => {
    it('panel starts open with default width', () => {
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_DEFAULT_WIDTH);
    });

    it('full collapse → expand → width restored', () => {
      // Resize to custom width
      useUIStore.getState().setLeftPanelWidth(280);
      expect(useUIStore.getState().leftPanelWidth).toBe(280);

      // Collapse
      useUIStore.getState().toggleLeftPanel();
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
      expect(useUIStore.getState().leftPanelWidth).toBe(280); // preserved

      // Expand
      useUIStore.getState().toggleLeftPanel();
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
      expect(useUIStore.getState().leftPanelWidth).toBe(280); // restored
    });

    it('multiple collapse/expand cycles preserve width', () => {
      useUIStore.getState().setLeftPanelWidth(350);
      for (let i = 0; i < 5; i++) {
        useUIStore.getState().toggleLeftPanel(); // close
        useUIStore.getState().toggleLeftPanel(); // open
      }
      expect(useUIStore.getState().leftPanelWidth).toBe(350);
    });
  });

  describe('Snap-to-collapse behavior (via resize handler logic)', () => {
    // These test the logic that the App.tsx resize handler uses:
    // if newWidth < LEFT_PANEL_COLLAPSE_THRESHOLD, close the panel

    it('width at threshold stays open', () => {
      // At exactly the threshold, the panel should stay open (clamped to min)
      useUIStore.getState().setLeftPanelWidth(LEFT_PANEL_COLLAPSE_THRESHOLD);
      // setLeftPanelWidth clamps to min, so it becomes LEFT_PANEL_MIN_WIDTH
      expect(useUIStore.getState().leftPanelWidth).toBe(LEFT_PANEL_MIN_WIDTH);
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
    });

    it('simulated snap-collapse closes panel', () => {
      // Simulate what App.tsx does when drag goes below threshold
      const newWidth = LEFT_PANEL_COLLAPSE_THRESHOLD - 1;
      if (newWidth < LEFT_PANEL_COLLAPSE_THRESHOLD) {
        useUIStore.getState().toggleLeftPanel();
      }
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
    });

    it('simulated snap-collapse preserves previous width', () => {
      useUIStore.getState().setLeftPanelWidth(250);
      // Simulate snap-collapse
      const newWidth = 50;
      if (newWidth < LEFT_PANEL_COLLAPSE_THRESHOLD) {
        useUIStore.getState().toggleLeftPanel();
      }
      // Width should be preserved at 250, not set to 50
      expect(useUIStore.getState().leftPanelWidth).toBe(250);
    });
  });

  describe('Expand strip (collapsed state)', () => {
    // Tests for the collapsed expand strip behavior
    // The expand strip is a button with data-testid="left-panel-expand"

    it('toggling open after collapse re-shows content', () => {
      useUIStore.getState().toggleLeftPanel(); // close
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
      useUIStore.getState().toggleLeftPanel(); // open
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
    });

    it('expand strip click opens panel to previous width', () => {
      useUIStore.getState().setLeftPanelWidth(320);
      useUIStore.getState().toggleLeftPanel(); // collapse
      useUIStore.getState().toggleLeftPanel(); // expand via strip
      expect(useUIStore.getState().leftPanelWidth).toBe(320);
    });
  });

  describe('Canvas space reclamation', () => {
    it('closing left panel sets leftPanelOpen to false (canvas gets full width)', () => {
      useUIStore.getState().toggleLeftPanel();
      expect(useUIStore.getState().leftPanelOpen).toBe(false);
      // In the UI, flex-1 on the canvas means it fills the remaining space
    });

    it('reopening left panel sets leftPanelOpen to true (canvas shares width)', () => {
      useUIStore.getState().toggleLeftPanel(); // close
      useUIStore.getState().toggleLeftPanel(); // reopen
      expect(useUIStore.getState().leftPanelOpen).toBe(true);
    });
  });
});
