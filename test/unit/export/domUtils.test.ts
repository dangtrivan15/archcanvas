import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCanvasBackground, filterGhostElements } from '@/export/domUtils';

describe('getCanvasBackground', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'react-flow';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('returns computed background color of .react-flow element', () => {
    container.style.backgroundColor = 'rgb(255, 0, 0)';
    expect(getCanvasBackground()).toBe('rgb(255, 0, 0)');
  });

  it('falls back when background is transparent', () => {
    container.style.backgroundColor = 'transparent';
    const bg = getCanvasBackground();
    // Should return a valid color string (CSS variable value or '#ffffff')
    expect(typeof bg).toBe('string');
    expect(bg.length).toBeGreaterThan(0);
    // Should match a color format (hex, rgb, or named color)
    expect(bg).toMatch(/^(#[0-9a-fA-F]{3,8}|rgb|[a-z]).*$/);
  });

  it('falls back when no .react-flow element exists', () => {
    document.body.removeChild(container);
    const bg = getCanvasBackground();
    expect(typeof bg).toBe('string');
    expect(bg.length).toBeGreaterThan(0);
    expect(bg).toMatch(/^(#[0-9a-fA-F]{3,8}|rgb|[a-z]).*$/);
    // Re-create container for afterEach
    container = document.createElement('div');
    container.className = 'react-flow';
    document.body.appendChild(container);
  });
});

describe('filterGhostElements', () => {
  it('returns true for normal elements', () => {
    const el = document.createElement('div');
    expect(filterGhostElements(el)).toBe(true);
  });

  it('returns false for ghost elements', () => {
    const el = document.createElement('div');
    el.dataset.ghost = 'true';
    expect(filterGhostElements(el)).toBe(false);
  });

  it('returns false for minimap elements', () => {
    const el = document.createElement('div');
    el.classList.add('react-flow__minimap');
    expect(filterGhostElements(el)).toBe(false);
  });

  it('returns false for controls elements', () => {
    const el = document.createElement('div');
    el.classList.add('react-flow__controls');
    expect(filterGhostElements(el)).toBe(false);
  });

  it('returns true for non-ghost data attribute', () => {
    const el = document.createElement('div');
    el.dataset.ghost = 'false';
    expect(filterGhostElements(el)).toBe(true);
  });
});
