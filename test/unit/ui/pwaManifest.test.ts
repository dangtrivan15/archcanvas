/**
 * Tests for PWA Web App Manifest and App Icons
 *
 * Feature #288: Verifies manifest.json, app icons, and HTML meta tags
 * are properly configured for PWA installation on desktop and mobile.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function fileSize(relativePath: string): number {
  return statSync(resolve(ROOT, relativePath)).size;
}

describe('Feature #288: Web app manifest and app icons for PWA', () => {
  // ─── Step 1: manifest.json ────────────────────────────────────────
  describe('manifest.json', () => {
    it('exists in public/ directory', () => {
      expect(fileExists('public/manifest.json')).toBe(true);
    });

    const manifest = JSON.parse(readFile('public/manifest.json'));

    it('has name field set to ArchCanvas', () => {
      expect(manifest.name).toBe('ArchCanvas');
    });

    it('has short_name field', () => {
      expect(manifest.short_name).toBeDefined();
      expect(typeof manifest.short_name).toBe('string');
      expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    });

    it('has description field', () => {
      expect(manifest.description).toBeDefined();
      expect(typeof manifest.description).toBe('string');
      expect(manifest.description.length).toBeGreaterThan(10);
    });

    it('has theme_color in dark theme', () => {
      expect(manifest.theme_color).toBeDefined();
      // Should be a hex color
      expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has background_color matching theme', () => {
      expect(manifest.background_color).toBeDefined();
      expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has display: standalone for PWA mode', () => {
      expect(manifest.display).toBe('standalone');
    });

    it('has start_url: /', () => {
      expect(manifest.start_url).toBe('/');
    });

    it('has icons array with required sizes', () => {
      expect(manifest.icons).toBeDefined();
      expect(Array.isArray(manifest.icons)).toBe(true);

      const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
    });

    it('has at least one icon with purpose "any"', () => {
      const anyIcons = manifest.icons.filter(
        (i: { purpose: string }) => i.purpose === 'any' || i.purpose === 'any maskable',
      );
      expect(anyIcons.length).toBeGreaterThan(0);
    });

    it('has at least one maskable icon', () => {
      const maskableIcons = manifest.icons.filter(
        (i: { purpose: string }) => i.purpose === 'maskable' || i.purpose === 'any maskable',
      );
      expect(maskableIcons.length).toBeGreaterThan(0);
    });

    it('all icons have type field', () => {
      for (const icon of manifest.icons) {
        expect(icon.type).toBeDefined();
        expect(icon.type).toMatch(/^image\/(png|svg\+xml)$/);
      }
    });

    it('all icons have valid src paths', () => {
      for (const icon of manifest.icons) {
        expect(icon.src).toBeDefined();
        expect(icon.src).toMatch(/^\//); // Starts with /
      }
    });
  });

  // ─── Step 2: App icon files ───────────────────────────────────────
  describe('App icon files', () => {
    it('has 192x192 PNG icon', () => {
      expect(fileExists('public/icons/icon-192x192.png')).toBe(true);
      expect(fileSize('public/icons/icon-192x192.png')).toBeGreaterThan(100);
    });

    it('has 512x512 PNG icon', () => {
      expect(fileExists('public/icons/icon-512x512.png')).toBe(true);
      expect(fileSize('public/icons/icon-512x512.png')).toBeGreaterThan(100);
    });

    it('has maskable 192x192 PNG icon', () => {
      expect(fileExists('public/icons/icon-maskable-192x192.png')).toBe(true);
      expect(fileSize('public/icons/icon-maskable-192x192.png')).toBeGreaterThan(100);
    });

    it('has maskable 512x512 PNG icon', () => {
      expect(fileExists('public/icons/icon-maskable-512x512.png')).toBe(true);
      expect(fileSize('public/icons/icon-maskable-512x512.png')).toBeGreaterThan(100);
    });

    it('has 180x180 apple-touch-icon', () => {
      expect(fileExists('public/icons/icon-180x180.png')).toBe(true);
      expect(fileSize('public/icons/icon-180x180.png')).toBeGreaterThan(100);
    });

    it('PNG files start with valid PNG signature', () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // \x89PNG
      const iconFiles = [
        'public/icons/icon-192x192.png',
        'public/icons/icon-512x512.png',
        'public/icons/icon-180x180.png',
      ];
      for (const file of iconFiles) {
        const buffer = readFileSync(resolve(ROOT, file));
        expect(buffer.subarray(0, 4).equals(pngSignature)).toBe(true);
      }
    });
  });

  // ─── Step 3: apple-touch-icon link in index.html ──────────────────
  describe('index.html apple-touch-icon', () => {
    const html = readFile('index.html');

    it('has apple-touch-icon link tag', () => {
      expect(html).toContain('rel="apple-touch-icon"');
    });

    it('apple-touch-icon points to a PNG file', () => {
      const match = html.match(/<link[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/);
      expect(match).not.toBeNull();
      expect(match![1]).toMatch(/\.png$/);
    });

    it('apple-touch-icon has sizes attribute', () => {
      const match = html.match(/<link[^>]*rel="apple-touch-icon"[^>]*sizes="([^"]+)"/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('180x180');
    });
  });

  // ─── Step 4: manifest link in index.html ──────────────────────────
  describe('index.html manifest link', () => {
    const html = readFile('index.html');

    it('has manifest link tag', () => {
      expect(html).toContain('rel="manifest"');
    });

    it('manifest link points to /manifest.json', () => {
      const match = html.match(/<link[^>]*rel="manifest"[^>]*href="([^"]+)"/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('/manifest.json');
    });
  });

  // ─── Step 5: theme-color meta tag ─────────────────────────────────
  describe('index.html theme-color', () => {
    const html = readFile('index.html');

    it('has theme-color meta tag', () => {
      expect(html).toContain('name="theme-color"');
    });

    it('theme-color matches manifest theme_color', () => {
      const manifest = JSON.parse(readFile('public/manifest.json'));
      const match = html.match(/<meta[^>]*name="theme-color"[^>]*content="([^"]+)"/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe(manifest.theme_color);
    });
  });

  // ─── Step 6: PWA readiness checks ─────────────────────────────────
  describe('PWA readiness', () => {
    const html = readFile('index.html');
    const manifest = JSON.parse(readFile('public/manifest.json'));

    it('has apple-mobile-web-app-capable meta tag', () => {
      expect(html).toContain('apple-mobile-web-app-capable');
    });

    it('has mobile-web-app-capable meta tag', () => {
      expect(html).toContain('mobile-web-app-capable');
    });

    it('manifest has all required PWA fields', () => {
      const requiredFields = [
        'name',
        'short_name',
        'icons',
        'start_url',
        'display',
        'theme_color',
        'background_color',
      ];
      for (const field of requiredFields) {
        expect(manifest[field]).toBeDefined();
      }
    });

    it('has at least one 192x192 icon (minimum for Chrome install)', () => {
      const has192 = manifest.icons.some((i: { sizes: string }) => i.sizes === '192x192');
      expect(has192).toBe(true);
    });

    it('has at least one 512x512 icon (for splash screen)', () => {
      const has512 = manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512');
      expect(has512).toBe(true);
    });

    it('favicon link tags exist', () => {
      expect(html).toContain('rel="icon"');
    });
  });

  // ─── Implementation completeness ──────────────────────────────────
  describe('Implementation completeness', () => {
    it('icon generation script exists', () => {
      expect(fileExists('scripts/generate-icons.mjs')).toBe(true);
    });

    it('all manifest icon paths point to existing files', () => {
      const manifest = JSON.parse(readFile('public/manifest.json'));
      for (const icon of manifest.icons) {
        // Icon src starts with /, map to public/ directory
        const filePath = 'public' + icon.src;
        expect(fileExists(filePath)).toBe(true);
      }
    });
  });
});
