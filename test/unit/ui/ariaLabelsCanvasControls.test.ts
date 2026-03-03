/**
 * Tests for Feature #223: ARIA labels on canvas controls.
 * Verifies that canvas control buttons (zoom-in, zoom-out, fit-view, minimap)
 * have descriptive ARIA labels for screen reader accessibility.
 *
 * React Flow v12 provides built-in ARIA labels on its Controls component:
 * - Zoom In button: accessible name "Zoom In"
 * - Zoom Out button: accessible name "Zoom Out"
 * - Fit View button: accessible name "Fit View"
 * - Toggle Interactivity button: accessible name "Toggle Interactivity"
 * - MiniMap: accessible name "Mini Map"
 *
 * This test suite verifies the source code configuration that produces these labels.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Feature #223: ARIA labels on canvas controls', () => {
  // Read the Canvas.tsx source to verify ARIA configuration
  const canvasSource = readFileSync(
    resolve(__dirname, '../../../src/components/canvas/Canvas.tsx'),
    'utf-8',
  );

  describe('Controls component has ARIA attributes', () => {
    it('Controls component has aria-label attribute', () => {
      expect(canvasSource).toContain('aria-label="Canvas controls"');
    });

    it('Controls component has data-testid attribute', () => {
      expect(canvasSource).toContain('data-testid="canvas-controls"');
    });

    it('Controls component is positioned bottom-right', () => {
      expect(canvasSource).toContain('position="bottom-right"');
    });
  });

  describe('MiniMap component has ARIA attributes', () => {
    it('MiniMap component has aria-label attribute', () => {
      expect(canvasSource).toContain('aria-label="Mini map"');
    });

    it('MiniMap component has data-testid attribute', () => {
      expect(canvasSource).toContain('data-testid="canvas-minimap"');
    });

    it('MiniMap component is positioned bottom-left', () => {
      expect(canvasSource).toContain('position="bottom-left"');
    });

    it('MiniMap is pannable and zoomable', () => {
      expect(canvasSource).toContain('pannable');
      expect(canvasSource).toContain('zoomable');
    });
  });

  describe('Canvas imports Controls and MiniMap from React Flow', () => {
    it('imports Controls from @xyflow/react', () => {
      expect(canvasSource).toContain('Controls');
      expect(canvasSource).toContain("from '@xyflow/react'");
    });

    it('imports MiniMap from @xyflow/react', () => {
      expect(canvasSource).toContain('MiniMap');
    });
  });

  describe('React Flow Controls provides built-in button labels', () => {
    // These tests document the expected behavior of React Flow v12's Controls component.
    // The actual labels are rendered by the library at runtime.
    // Browser tests verify the rendered output.

    it('Controls component is rendered without showZoom=false (zoom buttons shown by default)', () => {
      // Controls component should NOT have showZoom={false}
      expect(canvasSource).not.toContain('showZoom={false}');
    });

    it('Controls component is rendered without showFitView=false (fit view shown by default)', () => {
      expect(canvasSource).not.toContain('showFitView={false}');
    });

    it('Controls component is rendered without showInteractive=false (toggle shown by default)', () => {
      expect(canvasSource).not.toContain('showInteractive={false}');
    });
  });

  describe('Canvas has proper application role', () => {
    it('Canvas renders ReactFlow which provides application role', () => {
      expect(canvasSource).toContain('ReactFlow');
      expect(canvasSource).toContain('<ReactFlowProvider>');
    });

    it('Canvas has data-testid for testing', () => {
      expect(canvasSource).toContain('data-testid="canvas"');
    });
  });

  describe('Navigation breadcrumb has ARIA label', () => {
    const breadcrumbSource = readFileSync(
      resolve(__dirname, '../../../src/components/canvas/NavigationBreadcrumb.tsx'),
      'utf-8',
    );

    it('NavigationBreadcrumb container has aria-label', () => {
      expect(breadcrumbSource).toContain('aria-label');
    });
  });
});
