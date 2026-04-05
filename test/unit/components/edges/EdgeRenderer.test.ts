import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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

describe('EdgeRenderer', () => {
  describe('style categories', () => {
    it('renders path with edge-sync class for sync protocol', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ styleCategory: 'sync' }),
        }),
      );
      const path = container.querySelector('path');
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
      const path = container.querySelector('path');
      expect(path?.getAttribute('class')).toContain('edge-async');
    });

    it('renders path with edge-default class for default protocol', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ styleCategory: 'default' }),
        }),
      );
      const path = container.querySelector('path');
      expect(path?.getAttribute('class')).toContain('edge-default');
    });

    it('falls back to edge-default when styleCategory is missing', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: undefined,
        }),
      );
      const path = container.querySelector('path');
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
      const path = container.querySelector('path');
      expect(path?.id).toBe('edge-1');
    });

    it('always includes react-flow__edge-path class', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: makeData({ styleCategory: 'sync' }),
        }),
      );
      const path = container.querySelector('path');
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

  describe('null/undefined data handling', () => {
    it('handles undefined data gracefully — renders path without crashing', () => {
      const { container } = render(
        React.createElement(EdgeRenderer, {
          ...defaultProps,
          data: undefined,
        }),
      );
      // Should still render a path element, just with default style
      const path = container.querySelector('path');
      expect(path).toBeTruthy();
    });
  });
});
