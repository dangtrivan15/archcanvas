import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the sub-modules so we can verify they are called without side effects
vi.mock('@/export/inlineStyles', () => ({
  inlineStyles: vi.fn(),
}));

vi.mock('@/export/materializePseudos', () => ({
  materializePseudos: vi.fn(),
}));

vi.mock('@/export/embedFonts', () => ({
  embedFonts: vi.fn().mockResolvedValue(undefined),
}));

import { prepareExportClone } from '@/export/prepareExportClone';
import { inlineStyles } from '@/export/inlineStyles';
import { materializePseudos } from '@/export/materializePseudos';
import { embedFonts } from '@/export/embedFonts';

describe('prepareExportClone', () => {
  let viewport: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    viewport.innerHTML = '<div class="node">Hello</div>';
    document.body.appendChild(viewport);
  });

  afterEach(() => {
    viewport.parentNode?.removeChild(viewport);
    // Clean up any leftover wrappers
    const wrappers = document.querySelectorAll('[style*="-99999px"]');
    wrappers.forEach((w) => w.parentNode?.removeChild(w));
  });

  it('returns a clone of the viewport', async () => {
    const result = await prepareExportClone(viewport);

    expect(result.viewport).toBeInstanceOf(HTMLElement);
    expect(result.viewport).not.toBe(viewport);
    expect(result.viewport.querySelector('.node')).toBeTruthy();

    result.cleanup();
  });

  it('appends the wrapper to document.body', async () => {
    const result = await prepareExportClone(viewport);

    expect(result.wrapper.parentNode).toBe(document.body);
    expect(result.wrapper.style.position).toBe('fixed');
    expect(result.wrapper.style.left).toBe('-99999px');

    result.cleanup();
  });

  it('cleanup removes the wrapper from the DOM', async () => {
    const result = await prepareExportClone(viewport);

    expect(result.wrapper.parentNode).toBe(document.body);
    result.cleanup();
    expect(result.wrapper.parentNode).toBeNull();
  });

  it('calls inlineStyles with original and clone', async () => {
    const result = await prepareExportClone(viewport);

    expect(inlineStyles).toHaveBeenCalledTimes(1);
    expect(inlineStyles).toHaveBeenCalledWith(viewport, result.viewport);

    result.cleanup();
  });

  it('calls materializePseudos with original and clone', async () => {
    const result = await prepareExportClone(viewport);

    expect(materializePseudos).toHaveBeenCalledTimes(1);
    expect(materializePseudos).toHaveBeenCalledWith(viewport, result.viewport);

    result.cleanup();
  });

  it('calls embedFonts with the wrapper', async () => {
    const result = await prepareExportClone(viewport);

    expect(embedFonts).toHaveBeenCalledTimes(1);
    expect(embedFonts).toHaveBeenCalledWith(result.wrapper);

    result.cleanup();
  });

  it('filters ghost elements from the clone', async () => {
    // Add a ghost element to the viewport
    const ghost = document.createElement('div');
    ghost.dataset.ghost = 'true';
    ghost.textContent = 'ghost';
    viewport.appendChild(ghost);

    const result = await prepareExportClone(viewport);

    const ghostInClone = result.viewport.querySelector('[data-ghost="true"]');
    expect(ghostInClone).toBeNull();

    result.cleanup();
  });

  it('filters minimap elements from the clone', async () => {
    const minimap = document.createElement('div');
    minimap.className = 'react-flow__minimap';
    viewport.appendChild(minimap);

    const result = await prepareExportClone(viewport);

    const minimapInClone = result.viewport.querySelector('.react-flow__minimap');
    expect(minimapInClone).toBeNull();

    result.cleanup();
  });

  it('filters controls elements from the clone', async () => {
    const controls = document.createElement('div');
    controls.className = 'react-flow__controls';
    viewport.appendChild(controls);

    const result = await prepareExportClone(viewport);

    const controlsInClone = result.viewport.querySelector('.react-flow__controls');
    expect(controlsInClone).toBeNull();

    result.cleanup();
  });

  it('cleanup is safe to call multiple times', async () => {
    const result = await prepareExportClone(viewport);

    result.cleanup();
    expect(() => result.cleanup()).not.toThrow();
  });
});
