// @vitest-environment happy-dom
/**
 * Tests for Keyboard Zoom Controls (feature #256).
 * Verifies +/= zoom in, - zoom out, Cmd+0 fit view, Cmd+1 zoom 100%.
 * Smooth animation, browser zoom prevention, command palette entries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_DURATION } from '@/store/canvasStore';
import { useCoreStore } from '@/store/coreStore';
import { useUIStore } from '@/store/uiStore';
import { getShortcutManager } from '@/core/shortcuts/shortcutManager';
import { getStaticCommands, searchCommands, getAllCommands } from '@/config/commandRegistry';

beforeEach(() => {
  useCoreStore.getState().initialize();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    zoomInCounter: 0,
    zoomOutCounter: 0,
    fitViewCounter: 0,
    zoom100Counter: 0,
  });
  useUIStore.setState({
    commandPaletteOpen: false,
  });
});

describe('Zoom Constants', () => {
  it('ZOOM_STEP is 0.2', () => {
    expect(ZOOM_STEP).toBe(0.2);
  });

  it('ZOOM_MIN is 0.1', () => {
    expect(ZOOM_MIN).toBe(0.1);
  });

  it('ZOOM_MAX is 2.0', () => {
    expect(ZOOM_MAX).toBe(2.0);
  });

  it('ZOOM_DURATION is 200ms for smooth animation', () => {
    expect(ZOOM_DURATION).toBe(200);
  });
});

describe('Zoom Store Actions', () => {
  it('requestZoomIn increments zoomInCounter', () => {
    const before = useCanvasStore.getState().zoomInCounter;
    useCanvasStore.getState().requestZoomIn();
    expect(useCanvasStore.getState().zoomInCounter).toBe(before + 1);
  });

  it('requestZoomOut increments zoomOutCounter', () => {
    const before = useCanvasStore.getState().zoomOutCounter;
    useCanvasStore.getState().requestZoomOut();
    expect(useCanvasStore.getState().zoomOutCounter).toBe(before + 1);
  });

  it('requestFitView increments fitViewCounter', () => {
    const before = useCanvasStore.getState().fitViewCounter;
    useCanvasStore.getState().requestFitView();
    expect(useCanvasStore.getState().fitViewCounter).toBe(before + 1);
  });

  it('requestZoom100 increments zoom100Counter', () => {
    const before = useCanvasStore.getState().zoom100Counter;
    useCanvasStore.getState().requestZoom100();
    expect(useCanvasStore.getState().zoom100Counter).toBe(before + 1);
  });

  it('multiple zoom-in requests increment counter correctly', () => {
    const before = useCanvasStore.getState().zoomInCounter;
    useCanvasStore.getState().requestZoomIn();
    useCanvasStore.getState().requestZoomIn();
    useCanvasStore.getState().requestZoomIn();
    expect(useCanvasStore.getState().zoomInCounter).toBe(before + 3);
  });

  it('mixed zoom operations track independently', () => {
    useCanvasStore.getState().requestZoomIn();
    useCanvasStore.getState().requestZoomOut();
    useCanvasStore.getState().requestFitView();
    useCanvasStore.getState().requestZoom100();

    const state = useCanvasStore.getState();
    expect(state.zoomInCounter).toBe(1);
    expect(state.zoomOutCounter).toBe(1);
    expect(state.fitViewCounter).toBe(1);
    expect(state.zoom100Counter).toBe(1);
  });
});

describe('Shortcut Registration', () => {
  it('view:zoom-in is bound to = key', () => {
    const manager = getShortcutManager();
    const actions = manager.getActions();
    const zoomIn = actions.find((a) => a.id === 'view:zoom-in');
    expect(zoomIn).toBeDefined();
    expect(zoomIn!.label).toBe('Zoom In');
    expect(zoomIn!.defaultBinding).toBe('=');
    expect(zoomIn!.category).toBe('View');
  });

  it('view:zoom-out is bound to - key', () => {
    const manager = getShortcutManager();
    const actions = manager.getActions();
    const zoomOut = actions.find((a) => a.id === 'view:zoom-out');
    expect(zoomOut).toBeDefined();
    expect(zoomOut!.label).toBe('Zoom Out');
    expect(zoomOut!.defaultBinding).toBe('-');
  });

  it('view:fit-all is bound to Cmd+0', () => {
    const manager = getShortcutManager();
    const actions = manager.getActions();
    const fitAll = actions.find((a) => a.id === 'view:fit-all');
    expect(fitAll).toBeDefined();
    expect(fitAll!.label).toBe('Fit View');
    expect(fitAll!.defaultBinding).toBe('mod+0');
  });

  it('view:zoom-100 is bound to Cmd+1', () => {
    const manager = getShortcutManager();
    const actions = manager.getActions();
    const zoom100 = actions.find((a) => a.id === 'view:zoom-100');
    expect(zoom100).toBeDefined();
    expect(zoom100!.label).toBe('Zoom to 100%');
    expect(zoom100!.defaultBinding).toBe('mod+1');
  });
});

describe('Command Palette Zoom Commands', () => {
  it('includes Zoom In command', () => {
    const commands = getStaticCommands();
    const zoomIn = commands.find((c) => c.label === 'Zoom In');
    expect(zoomIn).toBeDefined();
    expect(zoomIn!.category).toBe('View');
  });

  it('includes Zoom Out command', () => {
    const commands = getStaticCommands();
    const zoomOut = commands.find((c) => c.label === 'Zoom Out');
    expect(zoomOut).toBeDefined();
    expect(zoomOut!.category).toBe('View');
  });

  it('includes Fit View command', () => {
    const commands = getStaticCommands();
    const fitView = commands.find((c) => c.label === 'Fit View');
    expect(fitView).toBeDefined();
    expect(fitView!.category).toBe('View');
  });

  it('includes Zoom to 100% command', () => {
    const commands = getStaticCommands();
    const zoom100 = commands.find((c) => c.label === 'Zoom to 100%');
    expect(zoom100).toBeDefined();
    expect(zoom100!.category).toBe('View');
  });

  it('searchCommands finds zoom commands for "zoom" query', () => {
    const allCommands = getAllCommands();
    const results = searchCommands(allCommands, 'zoom');
    const zoomLabels = results.map((c) => c.label);
    expect(zoomLabels).toContain('Zoom In');
    expect(zoomLabels).toContain('Zoom Out');
    expect(zoomLabels).toContain('Zoom to 100%');
  });

  it('Zoom In command executes requestZoomIn', () => {
    const commands = getStaticCommands();
    const zoomIn = commands.find((c) => c.label === 'Zoom In')!;
    const before = useCanvasStore.getState().zoomInCounter;
    zoomIn.execute();
    expect(useCanvasStore.getState().zoomInCounter).toBe(before + 1);
  });

  it('Zoom Out command executes requestZoomOut', () => {
    const commands = getStaticCommands();
    const zoomOut = commands.find((c) => c.label === 'Zoom Out')!;
    const before = useCanvasStore.getState().zoomOutCounter;
    zoomOut.execute();
    expect(useCanvasStore.getState().zoomOutCounter).toBe(before + 1);
  });

  it('Fit View command executes requestFitView', () => {
    const commands = getStaticCommands();
    const fitView = commands.find((c) => c.label === 'Fit View')!;
    const before = useCanvasStore.getState().fitViewCounter;
    fitView.execute();
    expect(useCanvasStore.getState().fitViewCounter).toBe(before + 1);
  });

  it('Zoom to 100% command executes requestZoom100', () => {
    const commands = getStaticCommands();
    const zoom100 = commands.find((c) => c.label === 'Zoom to 100%')!;
    const before = useCanvasStore.getState().zoom100Counter;
    zoom100.execute();
    expect(useCanvasStore.getState().zoom100Counter).toBe(before + 1);
  });
});

describe('Zoom Status Bar Display', () => {
  it('status bar shows zoom level', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(source).toContain('data-testid="zoom-level"');
    expect(source).toContain('zoom');
  });

  it('zoom level displays as percentage', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/App.tsx', 'utf-8');
    expect(source).toContain('Math.round(zoom * 100)');
  });
});

describe('Browser Zoom Prevention', () => {
  it('useKeyboardShortcuts prevents Cmd+= browser zoom', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    // Intercept Cmd+= to prevent browser default zoom
    expect(source).toContain("key === '=' || key === '+'");
    expect(source).toContain('e.preventDefault()');
    expect(source).toContain('requestZoomIn()');
  });

  it('useKeyboardShortcuts prevents Cmd+- browser zoom', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    expect(source).toContain("key === '-'");
    expect(source).toContain('requestZoomOut()');
  });

  it('useKeyboardShortcuts prevents Cmd+0 browser reset', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    expect(source).toContain("key === '0'");
    expect(source).toContain('requestFitView()');
  });

  it('useKeyboardShortcuts prevents Cmd+1 browser tab switch', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/useKeyboardShortcuts.ts', 'utf-8');
    expect(source).toContain("key === '1'");
    expect(source).toContain('requestZoom100()');
  });
});

describe('Canvas Zoom Implementation', () => {
  it('Canvas viewport hook uses ZOOM_STEP, ZOOM_MIN, ZOOM_MAX, ZOOM_DURATION', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/hooks/useCanvasViewport.ts', 'utf-8');
    expect(source).toContain('ZOOM_STEP');
    expect(source).toContain('ZOOM_MIN');
    expect(source).toContain('ZOOM_MAX');
    expect(source).toContain('ZOOM_DURATION');
  });

  it('Canvas viewport hook watches zoom counter effects', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/hooks/useCanvasViewport.ts', 'utf-8');
    expect(source).toContain('zoomInCounter');
    expect(source).toContain('zoomOutCounter');
    expect(source).toContain('fitViewCounter');
    expect(source).toContain('zoom100Counter');
  });

  it('zoom-in uses Math.min to clamp at ZOOM_MAX', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/hooks/useCanvasViewport.ts', 'utf-8');
    expect(source).toContain('Math.min(ZOOM_MAX, vp.zoom + ZOOM_STEP)');
  });

  it('zoom-out uses Math.max to clamp at ZOOM_MIN', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/hooks/useCanvasViewport.ts', 'utf-8');
    expect(source).toContain('Math.max(ZOOM_MIN, vp.zoom - ZOOM_STEP)');
  });

  it('zoom-100 sets zoom to 1.0', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/hooks/useCanvasViewport.ts', 'utf-8');
    expect(source).toContain('zoom: 1.0');
  });

  it('fitView uses padding and duration', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/hooks/useCanvasViewport.ts', 'utf-8');
    expect(source).toContain('fitView({ padding: 0.2, duration: 300 })');
  });

  it('zoom animations use ZOOM_DURATION', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/hooks/useCanvasViewport.ts', 'utf-8');
    expect(source).toContain('duration: ZOOM_DURATION');
  });
});

describe('Zoom Edge Cases', () => {
  it('zoom values are sensible', () => {
    expect(ZOOM_MIN).toBeLessThan(1);
    expect(ZOOM_MAX).toBeGreaterThan(1);
    expect(ZOOM_STEP).toBeGreaterThan(0);
    expect(ZOOM_STEP).toBeLessThan(1);
    expect(ZOOM_DURATION).toBeGreaterThan(0);
    expect(ZOOM_DURATION).toBeLessThanOrEqual(1000);
  });

  it('zoom step fits evenly between min and max', () => {
    // 0.2 step: 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0
    const steps = Math.round((ZOOM_MAX - ZOOM_MIN) / ZOOM_STEP);
    expect(steps).toBeGreaterThan(3); // At least a few zoom levels
    expect(steps).toBeLessThan(50); // Not too many steps
  });

  it('setViewport updates viewport state', () => {
    useCanvasStore.getState().setViewport({ x: 100, y: 200, zoom: 1.5 });
    const state = useCanvasStore.getState();
    expect(state.viewport.x).toBe(100);
    expect(state.viewport.y).toBe(200);
    expect(state.viewport.zoom).toBe(1.5);
  });
});
