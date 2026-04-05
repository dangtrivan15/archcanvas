import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { Position } from '@xyflow/react';
import type { CanvasEdgeData } from '@/components/canvas/types';
import type { Edge } from '@/types/schema';

// Mock @xyflow/react so EdgeLabelRenderer renders its children without needing
// a ReactFlow context, and getBezierPath returns deterministic values.
vi.mock('@xyflow/react', () => ({
  getBezierPath: () => ['M0 0 C 10 10, 20 20, 30 30', 15, 15],
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Import after the mock is registered.
// eslint-disable-next-line import/first
import { EdgeRenderer } from '@/components/edges/EdgeRenderer';

const defaultProps = {
  id: 'edge-1',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
  source: 'node-a',
  target: 'node-b',
  selected: false,
  animated: false,
  interactionWidth: 20,
};

function makeEdge(partial: Partial<Edge> = {}): Edge {
  return {
    from: { node: 'a' },
    to: { node: 'b' },
    ...partial,
  };
}

function makeData(partial: Partial<CanvasEdgeData> = {}): CanvasEdgeData {
  return {
    edge: makeEdge(),
    styleCategory: 'default',
    ...partial,
  };
}

/** Helper: find the main edge path (the one with the edge id). */
function getMainPath(container: HTMLElement) {
  return container.querySelector(`path#edge-1`);
}

describe('EdgeRenderer', () => {
  describe('style categories', () => {
    it('renders path with edge-sync class for sync protocol', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ styleCategory: 'sync' }),
        }),
      );
      const path = getMainPath(container);
      expect(path).toBeTruthy();
      expect(path?.getAttribute('class')).toContain('edge-sync');
    });

    it('renders path with edge-async class for async protocol', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ styleCategory: 'async' }),
        }),
      );
      const path = getMainPath(container);
      expect(path?.getAttribute('class')).toContain('edge-async');
    });

    it('renders path with edge-default class for default protocol', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ styleCategory: 'default' }),
        }),
      );
      const path = getMainPath(container);
      expect(path?.getAttribute('class')).toContain('edge-default');
    });

    it('falls back to edge-default when styleCategory is missing', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: undefined,
        }),
      );
      const path = getMainPath(container);
      expect(path?.getAttribute('class')).toContain('edge-default');
    });
  });

  describe('path element', () => {
    it('sets id attribute on path element', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData(),
        }),
      );
      const path = getMainPath(container);
      expect(path?.id).toBe('edge-1');
    });

    it('always includes react-flow__edge-path class', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ styleCategory: 'sync' }),
        }),
      );
      const path = getMainPath(container);
      expect(path?.getAttribute('class')).toContain('react-flow__edge-path');
    });
  });

  describe('edge label', () => {
    it('renders label text when edge has a label', () => {
      const { getByText } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ edge: makeEdge({ label: 'calls' }) }),
        }),
      );
      expect(getByText('calls')).toBeTruthy();
    });

    it('does not render label container when edge has no label', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ edge: makeEdge({ label: undefined }) }),
        }),
      );
      expect(container.querySelector('.edge-label')).toBeNull();
    });
  });

  describe('entity pills', () => {
    it('renders entity pills when entities are present', () => {
      const { getByText } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({
            edge: makeEdge({ label: 'ships', entities: ['Order', 'User'] }),
          }),
        }),
      );
      expect(getByText('Order')).toBeTruthy();
      expect(getByText('User')).toBeTruthy();
    });

    it('does not render entity pills container when entities is empty', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({
            edge: makeEdge({ label: 'ships', entities: [] }),
          }),
        }),
      );
      expect(container.querySelector('.entity-pills')).toBeNull();
    });

    it('does not render entity pills container when entities is undefined', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({
            edge: makeEdge({ label: 'ships', entities: undefined }),
          }),
        }),
      );
      expect(container.querySelector('.entity-pills')).toBeNull();
    });
  });

  describe('selected edge styling', () => {
    it('applies edge-selected class when isSelected is true', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ isSelected: true }),
        }),
      );
      const path = getMainPath(container);
      expect(path?.getAttribute('class')).toContain('edge-selected');
    });

    it('does not apply edge-selected class when isSelected is false', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ isSelected: false }),
        }),
      );
      const path = getMainPath(container);
      expect(path?.getAttribute('class')).not.toContain('edge-selected');
    });

    it('does not apply edge-selected class when isSelected is undefined', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData(),
        }),
      );
      const path = getMainPath(container);
      expect(path?.getAttribute('class')).not.toContain('edge-selected');
    });
  });

  describe('selection halo', () => {
    it('renders halo path when edge is selected', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ isSelected: true }),
        }),
      );
      const halo = container.querySelector('.edge-halo');
      expect(halo).toBeTruthy();
      expect(halo?.getAttribute('d')).toBe('M0 0 C 10 10, 20 20, 30 30');
    });

    it('does not render halo path when edge is not selected', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ isSelected: false }),
        }),
      );
      expect(container.querySelector('.edge-halo')).toBeNull();
    });

    it('renders halo path when edge is highlighted', async () => {
      // Set highlighted edge IDs via the store
      const { useCanvasStore } = await import('@/store/canvasStore');
      useCanvasStore.setState({ highlightedEdgeIds: ['edge-1'] });

      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData(),
        }),
      );
      const halo = container.querySelector('.edge-halo');
      expect(halo).toBeTruthy();

      // Clean up
      useCanvasStore.setState({ highlightedEdgeIds: [] });
    });
  });

  describe('hover interaction', () => {
    it('renders interaction zone for non-inherited edges', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ inherited: false }),
        }),
      );
      expect(container.querySelector('.edge-interaction-zone')).toBeTruthy();
    });

    it('does not render interaction zone for inherited edges', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ inherited: true }),
        }),
      );
      expect(container.querySelector('.edge-interaction-zone')).toBeNull();
    });

    it('applies edge-hovered class on mouseenter and removes on mouseleave', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ inherited: false }),
        }),
      );
      const zone = container.querySelector('.edge-interaction-zone')!;
      const mainPath = getMainPath(container)!;

      // Initially no hover class
      expect(mainPath.getAttribute('class')).not.toContain('edge-hovered');

      // Mouse enter
      fireEvent.mouseEnter(zone);
      expect(mainPath.getAttribute('class')).toContain('edge-hovered');

      // Mouse leave
      fireEvent.mouseLeave(zone);
      expect(mainPath.getAttribute('class')).not.toContain('edge-hovered');
    });

    it('does not apply edge-hovered class for inherited edges', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ inherited: true }),
        }),
      );
      const mainPath = getMainPath(container)!;
      expect(mainPath.getAttribute('class')).not.toContain('edge-hovered');
    });
  });

  describe('edge label selection styling', () => {
    it('applies edge-label--selected class to label when edge is selected', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({
            isSelected: true,
            edge: makeEdge({ label: 'calls' }),
          }),
        }),
      );
      const label = container.querySelector('.edge-label');
      expect(label?.getAttribute('class')).toContain('edge-label--selected');
    });

    it('does not apply edge-label--selected class when edge is not selected', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({
            isSelected: false,
            edge: makeEdge({ label: 'calls' }),
          }),
        }),
      );
      const label = container.querySelector('.edge-label');
      expect(label?.getAttribute('class')).not.toContain('edge-label--selected');
    });

    it('applies edge-label--highlighted class when edge is highlighted', async () => {
      const { useCanvasStore } = await import('@/store/canvasStore');
      useCanvasStore.setState({ highlightedEdgeIds: ['edge-1'] });

      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ edge: makeEdge({ label: 'calls' }) }),
        }),
      );
      const label = container.querySelector('.edge-label');
      expect(label?.getAttribute('class')).toContain('edge-label--highlighted');

      // Clean up
      useCanvasStore.setState({ highlightedEdgeIds: [] });
    });
  });

  describe('null/undefined data handling', () => {
    it('handles undefined data gracefully — renders path without crashing', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: undefined,
        }),
      );
      // Should still render a path element, just with default style
      const path = getMainPath(container);
      expect(path).toBeTruthy();
    });
  });
});
