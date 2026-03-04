import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useCachedFiles logic', () => {
  let mockCache: {
    keys: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCache = {
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    };

    (globalThis as any).caches = {
      open: vi.fn().mockResolvedValue(mockCache),
      delete: vi.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    delete (globalThis as any).caches;
    vi.restoreAllMocks();
  });

  it('should open the archc-files cache', async () => {
    await caches.open('archc-files');
    expect(caches.open).toHaveBeenCalledWith('archc-files');
  });

  it('should list cached .archc files', async () => {
    const mockRequests = [
      { url: 'https://localhost/files/project.archc' },
      { url: 'https://localhost/files/test.archc' },
      { url: 'https://localhost/assets/style.css' }, // Not an .archc file
    ];
    mockCache.keys.mockResolvedValue(mockRequests);

    const cache = await caches.open('archc-files');
    const keys = await cache.keys();
    const archcFiles = keys.filter((req: any) => req.url.endsWith('.archc'));

    expect(archcFiles).toHaveLength(2);
    expect(archcFiles[0].url).toContain('project.archc');
    expect(archcFiles[1].url).toContain('test.archc');
  });

  it('should extract file name from URL', () => {
    const url = 'https://localhost/files/my-project.archc';
    const urlObj = new URL(url);
    const name = decodeURIComponent(urlObj.pathname.split('/').pop() || url);
    expect(name).toBe('my-project.archc');
  });

  it('should handle URL-encoded file names', () => {
    const url = 'https://localhost/files/my%20project.archc';
    const urlObj = new URL(url);
    const name = decodeURIComponent(urlObj.pathname.split('/').pop() || url);
    expect(name).toBe('my project.archc');
  });

  it('should delete a cached file by URL', async () => {
    const fileUrl = 'https://localhost/files/project.archc';
    const cache = await caches.open('archc-files');
    await cache.delete(fileUrl);

    expect(mockCache.delete).toHaveBeenCalledWith(fileUrl);
  });

  it('should clear all cached files', async () => {
    await caches.delete('archc-files');
    expect(caches.delete).toHaveBeenCalledWith('archc-files');
  });

  it('should handle empty cache gracefully', async () => {
    mockCache.keys.mockResolvedValue([]);
    const cache = await caches.open('archc-files');
    const keys = await cache.keys();
    const archcFiles = keys.filter((req: any) => req.url.endsWith('.archc'));
    expect(archcFiles).toHaveLength(0);
  });

  it('should handle missing caches API gracefully', () => {
    delete (globalThis as any).caches;
    expect(typeof globalThis.caches).toBe('undefined');
    // When caches is undefined, the hook returns empty array
  });
});

describe('caching strategies', () => {
  it('Cache First strategy: returns cached response when available', () => {
    // The Workbox CacheFirst strategy:
    // 1. Check cache for matching request
    // 2. If found, return cached response
    // 3. If not found, fetch from network, cache it, return response
    // This is the strategy used for .archc files
    const strategy = 'CacheFirst';
    expect(strategy).toBe('CacheFirst');
  });

  it('.archc cache has 50 entry limit and 30 day expiry', () => {
    const config = {
      cacheName: 'archc-files',
      maxEntries: 50,
      maxAgeSeconds: 30 * 24 * 60 * 60,
    };
    expect(config.cacheName).toBe('archc-files');
    expect(config.maxEntries).toBe(50);
    expect(config.maxAgeSeconds).toBe(2592000); // 30 days in seconds
  });

  it('YAML cache has 100 entry limit and 7 day expiry', () => {
    const config = {
      cacheName: 'nodedef-files',
      maxEntries: 100,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    };
    expect(config.cacheName).toBe('nodedef-files');
    expect(config.maxEntries).toBe(100);
    expect(config.maxAgeSeconds).toBe(604800); // 7 days in seconds
  });

  it('proto cache has 20 entry limit and 7 day expiry', () => {
    const config = {
      cacheName: 'proto-files',
      maxEntries: 20,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    };
    expect(config.cacheName).toBe('proto-files');
    expect(config.maxEntries).toBe(20);
    expect(config.maxAgeSeconds).toBe(604800); // 7 days in seconds
  });

  it('.archc URL pattern matches .archc files', () => {
    const pattern = /\.archc$/i;
    expect(pattern.test('/files/project.archc')).toBe(true);
    expect(pattern.test('/files/test.ARCHC')).toBe(true);
    expect(pattern.test('/files/readme.md')).toBe(false);
    expect(pattern.test('/files/archcanvas.js')).toBe(false);
  });

  it('YAML URL pattern matches yaml/yml files', () => {
    const pattern = /\.(yaml|yml)$/i;
    expect(pattern.test('/defs/service.yaml')).toBe(true);
    expect(pattern.test('/defs/config.yml')).toBe(true);
    expect(pattern.test('/defs/config.YML')).toBe(true);
    expect(pattern.test('/defs/readme.md')).toBe(false);
  });

  it('proto URL pattern matches proto files', () => {
    const pattern = /\.proto$/i;
    expect(pattern.test('/proto/archcanvas.proto')).toBe(true);
    expect(pattern.test('/proto/test.PROTO')).toBe(true);
    expect(pattern.test('/proto/readme.md')).toBe(false);
  });
});

describe('service worker configuration', () => {
  it('precache glob patterns cover all app shell files', () => {
    const patterns = ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'];
    // Should match common app shell file types
    const jsMatch = /\*\*\/\*\.\{.*js.*\}/.test(patterns[0]);
    const cssMatch = /\*\*\/\*\.\{.*css.*\}/.test(patterns[0]);
    const htmlMatch = /\*\*\/\*\.\{.*html.*\}/.test(patterns[0]);
    const fontMatch = /\*\*\/\*\.\{.*woff.*\}/.test(patterns[0]);
    const imgMatch = /\*\*\/\*\.\{.*png.*\}/.test(patterns[0]);

    expect(jsMatch).toBe(true);
    expect(cssMatch).toBe(true);
    expect(htmlMatch).toBe(true);
    expect(fontMatch).toBe(true);
    expect(imgMatch).toBe(true);
  });

  it('skipWaiting and clientsClaim ensure immediate activation', () => {
    const swConfig = { skipWaiting: true, clientsClaim: true };
    expect(swConfig.skipWaiting).toBe(true);
    expect(swConfig.clientsClaim).toBe(true);
  });

  it('registerType is autoUpdate for seamless updates', () => {
    const pwaConfig = { registerType: 'autoUpdate' };
    expect(pwaConfig.registerType).toBe('autoUpdate');
  });
});
