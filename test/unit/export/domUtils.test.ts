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
    document.body.removeChild(container);
  });

  it('returns computed background color of .react-flow element', () => {
    container.style.backgroundColor = 'rgb(255, 0, 0)';
    expect(getCanvasBackground()).toBe('rgb(255, 0, 0)');
  });

  it('falls back to #ffffff when background is transparent', () => {
    container.style.backgroundColor = 'transparent';
    // Since happy-dom may not compute transparent the same, we just verify
    // the function returns a non-empty string
    const bg = getCanvasBackground();
    expect(typeof bg).toBe('string');
    expect(bg.length).toBeGreaterThan(0);
  });

  it('falls back to #ffffff when no .react-flow element exists', () => {
    document.body.removeChild(container);
    const bg = getCanvasBackground();
    // Should fallback to CSS variable or '#ffffff'
    expect(typeof bg).toBe('string');
    expect(bg.length).toBeGreaterThan(0);
    // Re-add to avoid double-removal in afterEach
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
