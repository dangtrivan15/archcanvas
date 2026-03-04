/**
 * Tests for Safe Area Insets (iPad notch, home indicator, status bar)
 *
 * Feature #285: Verifies CSS safe area insets are properly applied so the app UI
 * doesn't overlap with the iPad notch, home indicator, or status bar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

describe('Feature #285: Safe area insets for iPad notch and home indicator', () => {
  // ─── Step 1: viewport-fit=cover meta tag ───────────────────────────
  describe('viewport meta tag', () => {
    const indexHtml = readFile('index.html');

    it('has viewport-fit=cover in the viewport meta tag', () => {
      expect(indexHtml).toContain('viewport-fit=cover');
    });

    it('has the viewport meta tag with required attributes', () => {
      const viewportMatch = indexHtml.match(/<meta[^>]*name="viewport"[^>]*content="([^"]+)"/);
      expect(viewportMatch).not.toBeNull();
      const content = viewportMatch![1];
      expect(content).toContain('width=device-width');
      expect(content).toContain('viewport-fit=cover');
    });

    it('has apple-mobile-web-app-capable meta tag', () => {
      expect(indexHtml).toContain('apple-mobile-web-app-capable');
    });

    it('has apple-mobile-web-app-status-bar-style meta tag', () => {
      expect(indexHtml).toContain('apple-mobile-web-app-status-bar-style');
    });
  });

  // ─── Step 2: CSS safe area classes ─────────────────────────────────
  describe('CSS safe area classes in index.css', () => {
    const css = readFile('src/index.css');

    it('defines .safe-area-top with env(safe-area-inset-top)', () => {
      expect(css).toContain('.safe-area-top');
      expect(css).toContain('padding-top: env(safe-area-inset-top');
    });

    it('defines .safe-area-bottom with env(safe-area-inset-bottom)', () => {
      expect(css).toContain('.safe-area-bottom');
      expect(css).toContain('padding-bottom: env(safe-area-inset-bottom');
    });

    it('defines .safe-area-left with env(safe-area-inset-left)', () => {
      expect(css).toContain('.safe-area-left');
      expect(css).toContain('padding-left: env(safe-area-inset-left');
    });

    it('defines .safe-area-right with env(safe-area-inset-right)', () => {
      expect(css).toContain('.safe-area-right');
      expect(css).toContain('padding-right: env(safe-area-inset-right');
    });

    it('defines combined .safe-area-insets class', () => {
      expect(css).toContain('.safe-area-insets');
      // Should contain all four directions
      const insetBlock = css.slice(css.indexOf('.safe-area-insets'));
      expect(insetBlock).toContain('env(safe-area-inset-top');
      expect(insetBlock).toContain('env(safe-area-inset-right');
      expect(insetBlock).toContain('env(safe-area-inset-bottom');
      expect(insetBlock).toContain('env(safe-area-inset-left');
    });

    it('uses fallback value of 0px for each inset', () => {
      // Each env() should have a 0px fallback for browsers that don't support it
      expect(css).toContain('env(safe-area-inset-top, 0px)');
      expect(css).toContain('env(safe-area-inset-right, 0px)');
      expect(css).toContain('env(safe-area-inset-bottom, 0px)');
      expect(css).toContain('env(safe-area-inset-left, 0px)');
    });
  });

  // ─── Step 3: Toolbar safe area ─────────────────────────────────────
  describe('Toolbar component', () => {
    const toolbar = readFile('src/components/toolbar/Toolbar.tsx');

    it('has safe-area-top class for top safe area (notch/status bar)', () => {
      expect(toolbar).toContain('safe-area-top');
    });

    it('has safe-area-left class for landscape left inset', () => {
      expect(toolbar).toContain('safe-area-left');
    });

    it('has safe-area-right class for landscape right inset', () => {
      expect(toolbar).toContain('safe-area-right');
    });

    it('still has sticky top-0 positioning', () => {
      expect(toolbar).toContain('sticky top-0');
    });
  });

  // ─── Step 4: Footer status bar safe area ───────────────────────────
  describe('Footer status bar (App.tsx)', () => {
    const appTsx = readFile('src/App.tsx');

    it('has safe-area-bottom class on the footer', () => {
      // Find the footer element and check for safe-area-bottom
      const footerMatch = appTsx.match(/<footer[^>]*className="([^"]+)"/);
      expect(footerMatch).not.toBeNull();
      expect(footerMatch![1]).toContain('safe-area-bottom');
    });

    it('has safe-area-left class on the footer for landscape', () => {
      const footerMatch = appTsx.match(/<footer[^>]*className="([^"]+)"/);
      expect(footerMatch).not.toBeNull();
      expect(footerMatch![1]).toContain('safe-area-left');
    });

    it('has safe-area-right class on the footer for landscape', () => {
      const footerMatch = appTsx.match(/<footer[^>]*className="([^"]+)"/);
      expect(footerMatch).not.toBeNull();
      expect(footerMatch![1]).toContain('safe-area-right');
    });
  });

  // ─── Step 5: Side panels safe area (landscape) ────────────────────
  describe('Side panels (App.tsx)', () => {
    const appTsx = readFile('src/App.tsx');

    it('has safe-area-left class on the left panel', () => {
      const leftPanelMatch = appTsx.match(/data-testid="left-panel"[^>]*>|className="[^"]*safe-area-left[^"]*"[^>]*data-testid="left-panel"/);
      // Also check by finding the left panel aside
      expect(appTsx).toMatch(/left-panel[\s\S]{0,200}safe-area-left|safe-area-left[\s\S]{0,200}left-panel/);
    });

    it('has safe-area-right class on the right panel', () => {
      expect(appTsx).toMatch(/right-panel[\s\S]{0,200}safe-area-right|safe-area-right[\s\S]{0,200}right-panel/);
    });
  });

  // ─── Step 6: Desktop browser unaffected ────────────────────────────
  describe('Desktop browser compatibility', () => {
    const css = readFile('src/index.css');

    it('uses env() with 0px fallback (no effect on desktop)', () => {
      // Every env() property call should have a 0px fallback
      // Match only the actual CSS property env() calls (not comments with wildcard *)
      const envCalls = css.match(/env\(safe-area-inset-(?:top|right|bottom|left)[^)]*\)/g) || [];
      expect(envCalls.length).toBeGreaterThan(0);
      for (const call of envCalls) {
        expect(call).toContain('0px');
      }
    });

    it('does not apply any fixed padding values (only env-based)', () => {
      // Safe area classes should only use env() values, not fixed pixel values
      const safeAreaSection = css.slice(css.indexOf('Safe Area Insets'));
      // No fixed padding values like "padding-top: 20px" in the safe area section
      const fixedPaddingMatch = safeAreaSection.match(/padding-(?:top|bottom|left|right):\s*\d+px/);
      expect(fixedPaddingMatch).toBeNull();
    });
  });

  // ─── Step 7: Implementation completeness ───────────────────────────
  describe('Implementation completeness', () => {
    it('index.html has viewport-fit=cover', () => {
      const html = readFile('index.html');
      expect(html).toContain('viewport-fit=cover');
    });

    it('CSS defines all safe area utility classes', () => {
      const css = readFile('src/index.css');
      expect(css).toContain('.safe-area-top');
      expect(css).toContain('.safe-area-bottom');
      expect(css).toContain('.safe-area-left');
      expect(css).toContain('.safe-area-right');
      expect(css).toContain('.safe-area-insets');
    });

    it('Toolbar applies top, left, right safe area classes', () => {
      const toolbar = readFile('src/components/toolbar/Toolbar.tsx');
      expect(toolbar).toContain('safe-area-top');
      expect(toolbar).toContain('safe-area-left');
      expect(toolbar).toContain('safe-area-right');
    });

    it('Footer applies bottom, left, right safe area classes', () => {
      const app = readFile('src/App.tsx');
      const footerMatch = app.match(/<footer[^>]*className="([^"]+)"/);
      expect(footerMatch).not.toBeNull();
      const footerClasses = footerMatch![1];
      expect(footerClasses).toContain('safe-area-bottom');
      expect(footerClasses).toContain('safe-area-left');
      expect(footerClasses).toContain('safe-area-right');
    });

    it('Left panel applies left safe area class', () => {
      const app = readFile('src/App.tsx');
      // Verify the left panel aside has safe-area-left in its className
      const leftPanelSection = app.slice(
        app.indexOf('data-testid="left-panel"') - 200,
        app.indexOf('data-testid="left-panel"')
      );
      expect(leftPanelSection).toContain('safe-area-left');
    });

    it('Right panel applies right safe area class', () => {
      const app = readFile('src/App.tsx');
      const rightPanelSection = app.slice(
        app.indexOf('data-testid="right-panel"') - 200,
        app.indexOf('data-testid="right-panel"')
      );
      expect(rightPanelSection).toContain('safe-area-right');
    });
  });
});
