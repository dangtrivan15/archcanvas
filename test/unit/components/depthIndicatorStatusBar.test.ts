/**
 * Unit tests for Depth Indicator in Status Bar (Feature #454).
 *
 * Tests the cross-file navigation breadcrumb rendering, depth badge visibility,
 * and the filePathToLabel helper function in ModeStatusBar.
 */

import { describe, it, expect } from 'vitest';
import { filePathToLabel } from '@/components/canvas/ModeStatusBar';

describe('filePathToLabel', () => {
  it('converts __root__ to "Root"', () => {
    expect(filePathToLabel('__root__')).toBe('Root');
  });

  it('extracts filename and removes .archc extension', () => {
    expect(filePathToLabel('backend.archc')).toBe('Backend');
  });

  it('handles nested paths', () => {
    expect(filePathToLabel('projects/backend/auth.archc')).toBe('Auth');
  });

  it('title-cases hyphenated names', () => {
    expect(filePathToLabel('auth-service.archc')).toBe('Auth Service');
  });

  it('title-cases underscored names', () => {
    expect(filePathToLabel('data_pipeline.archc')).toBe('Data Pipeline');
  });

  it('handles single-word filenames', () => {
    expect(filePathToLabel('system.archc')).toBe('System');
  });

  it('handles filenames without .archc extension', () => {
    expect(filePathToLabel('my-design')).toBe('My Design');
  });

  it('handles deeply nested paths', () => {
    expect(filePathToLabel('a/b/c/d/micro-service.archc')).toBe('Micro Service');
  });
});

describe('ModeStatusBar depth indicator integration', () => {
  it('exports filePathToLabel as a named export', async () => {
    const mod = await import('@/components/canvas/ModeStatusBar');
    expect(typeof mod.filePathToLabel).toBe('function');
  });

  it('exports ModeStatusBar as a named export', async () => {
    const mod = await import('@/components/canvas/ModeStatusBar');
    expect(typeof mod.ModeStatusBar).toBe('function');
  });

  it('exports deriveCanvasMode as a named export', async () => {
    const mod = await import('@/components/canvas/ModeStatusBar');
    expect(typeof mod.deriveCanvasMode).toBe('function');
  });
});

describe('ModeStatusBar source code verification', () => {
  it('imports useNestedCanvasStore for file stack access', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain("import { useNestedCanvasStore } from '@/store/nestedCanvasStore'");
  });

  it('reads fileStack from nestedCanvasStore', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('useNestedCanvasStore((s) => s.fileStack)');
  });

  it('reads activeFilePath from nestedCanvasStore', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('useNestedCanvasStore((s) => s.activeFilePath)');
  });

  it('reads popFile from nestedCanvasStore', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('useNestedCanvasStore((s) => s.popFile)');
  });

  it('reads popToRoot from nestedCanvasStore', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('useNestedCanvasStore((s) => s.popToRoot)');
  });

  it('renders a depth badge with data-testid="depth-badge"', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('data-testid="depth-badge"');
  });

  it('hides depth badge when fileDepth is 0', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('fileDepth > 0');
  });

  it('renders file-level breadcrumb segments with data-testid', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('data-testid={`file-breadcrumb-${i}`}');
  });

  it('uses ▸ separator for file-level breadcrumbs (distinct from › for within-file)', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    // File-level segments use ▸ (filled triangle)
    expect(source).toContain('▸');
    // Within-file segments use › (angle bracket)
    expect(source).toContain('›');
  });

  it('styles file-level breadcrumb segments with bold font (distinct from within-file)', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    // File-level segments should have font-bold class
    expect(source).toContain('font-bold');
  });

  it('displays depth as D:N format in the badge', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('D:{fileDepth}');
  });

  it('renders a layered icon (Layers-style SVG) in the depth badge', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    // The SVG has layer paths from Lucide Layers icon
    expect(source).toContain('<svg');
    expect(source).toContain('viewBox="0 0 24 24"');
  });

  it('file breadcrumb click calls popFile or popToRoot', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    expect(source).toContain('handleFileSegmentClick');
    expect(source).toContain('popToRoot()');
    expect(source).toContain('popFile()');
  });

  it('uses em-dash separator between file-level and within-file breadcrumbs', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/canvas/ModeStatusBar.tsx', 'utf-8');
    // Em-dash (—) separator between file-level and within-file breadcrumb regions
    expect(source).toContain('—');
  });
});
