/**
 * Unit tests for NodeShell component and shapeRegistry.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodeShell } from '@/components/nodes/shapes/NodeShell';
import {
  shapeRegistry,
  shapeNames,
  cylinderLid,
  type ShapeName,
} from '@/components/nodes/shapes/shapeRegistry';

// ── shapeRegistry tests ─────────────────────────────────────────────────

describe('shapeRegistry', () => {
  it('exports all 8 shape names', () => {
    expect(shapeNames).toHaveLength(8);
    expect(shapeNames).toEqual(
      expect.arrayContaining([
        'rectangle',
        'cylinder',
        'hexagon',
        'parallelogram',
        'cloud',
        'stadium',
        'document',
        'badge',
      ]),
    );
  });

  it('each shape generator returns a non-empty string path', () => {
    for (const name of shapeNames) {
      const path = shapeRegistry[name](200, 100);
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
      expect(path.length).toBeGreaterThan(5);
    }
  });

  it('rectangle path starts with M and ends with Z', () => {
    const path = shapeRegistry.rectangle(200, 100);
    expect(path).toMatch(/^M\s/);
    expect(path).toMatch(/Z$/);
  });

  it('cylinder path forms a closed shape', () => {
    const path = shapeRegistry.cylinder(200, 120);
    expect(path).toMatch(/Z$/);
  });

  it('cylinderLid produces a valid path', () => {
    const lid = cylinderLid(200, 120);
    expect(lid).toBeTruthy();
    expect(lid).toMatch(/Z$/);
  });

  it('hexagon path has 6 vertices (L commands)', () => {
    const path = shapeRegistry.hexagon(200, 100);
    // hexagon: M + 5 L commands + Z
    const lCommands = path.match(/L\s/g);
    expect(lCommands?.length).toBe(5);
  });

  it('stadium degenerates to circle-like when width <= height', () => {
    const path = shapeRegistry.stadium(50, 100);
    expect(path).toMatch(/^M/);
    expect(path).toMatch(/Z$/);
  });

  it('shapes scale with different dimensions', () => {
    for (const name of shapeNames) {
      const small = shapeRegistry[name](100, 60);
      const large = shapeRegistry[name](400, 200);
      // Different dimensions should produce different paths
      expect(small).not.toBe(large);
    }
  });
});

// ── NodeShell component tests ───────────────────────────────────────────

// Mock ResizeObserver for happy-dom
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  (globalThis as any).ResizeObserver = MockResizeObserver;
});

describe('NodeShell component', () => {
  it('renders with correct shape data attribute', () => {
    render(<NodeShell shape="hexagon" />);
    const shell = screen.getByTestId('node-shell');
    expect(shell.getAttribute('data-shape')).toBe('hexagon');
  });

  it('renders SVG with path element', () => {
    render(<NodeShell shape="rectangle" width={200} height={100} />);
    expect(screen.getByTestId('node-shell-svg')).toBeTruthy();
    expect(screen.getByTestId('node-shell-path')).toBeTruthy();
  });

  it('renders children inside foreignObject', () => {
    render(
      <NodeShell shape="stadium" width={200} height={80}>
        <span data-testid="inner-content">Hello World</span>
      </NodeShell>,
    );
    expect(screen.getByTestId('inner-content')).toBeTruthy();
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('renders cylinder lid for cylinder shape', () => {
    render(<NodeShell shape="cylinder" width={200} height={120} />);
    expect(screen.getByTestId('node-shell-cylinder-lid')).toBeTruthy();
  });

  it('does NOT render cylinder lid for non-cylinder shapes', () => {
    render(<NodeShell shape="rectangle" width={200} height={100} />);
    expect(screen.queryByTestId('node-shell-cylinder-lid')).toBeNull();
  });

  it('renders selection ring when selected', () => {
    render(<NodeShell shape="badge" width={200} height={100} selected />);
    expect(screen.getByTestId('node-shell-selection-ring')).toBeTruthy();
  });

  it('does NOT render selection ring when not selected', () => {
    render(<NodeShell shape="badge" width={200} height={100} selected={false} />);
    expect(screen.queryByTestId('node-shell-selection-ring')).toBeNull();
  });

  it('applies correct viewBox dimensions', () => {
    render(<NodeShell shape="rectangle" width={250} height={150} />);
    const svg = screen.getByTestId('node-shell-svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 250 150');
    expect(svg.getAttribute('width')).toBe('250');
    expect(svg.getAttribute('height')).toBe('150');
  });

  it.each(shapeNames)('renders %s shape without errors', (shapeName) => {
    const { container } = render(
      <NodeShell shape={shapeName as ShapeName} width={200} height={100}>
        <div>Content for {shapeName}</div>
      </NodeShell>,
    );
    expect(container.querySelector('[data-testid="node-shell-path"]')).toBeTruthy();
  });

  it('applies custom width', () => {
    render(<NodeShell shape="rectangle" width={300} height={100} />);
    const shell = screen.getByTestId('node-shell');
    expect(shell.style.width).toBe('300px');
  });

  it('foreignObject has inner content wrapper', () => {
    render(
      <NodeShell shape="cloud" width={200} height={100}>
        <p>Cloud content</p>
      </NodeShell>,
    );
    expect(screen.getByTestId('node-shell-content')).toBeTruthy();
    expect(screen.getByTestId('node-shell-foreign-object')).toBeTruthy();
  });
});
