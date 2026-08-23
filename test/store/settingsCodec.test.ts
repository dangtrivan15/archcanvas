import { describe, it, expect, vi } from 'vitest';
import {
  parseSettings,
  serializeSettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  type Settings,
} from '@/storage/settingsCodec';
import type { FileSystem } from '@/platform/fileSystem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockFs(files: Record<string, string> = {}): FileSystem {
  const store = { ...files };
  return {
    getName: () => 'mock',
    getPath: () => null,
    readFile: vi.fn(async (path: string) => {
      if (!(path in store)) throw new Error(`File not found: ${path}`);
      return store[path];
    }),
    readFileBytes: vi.fn(async () => new Uint8Array()),
    stat: vi.fn(async () => ({ type: 'file' as const, size: 0, mtimeMs: 0 })),
    writeFile: vi.fn(async (path: string, content: string) => {
      store[path] = content;
    }),
    listFiles: vi.fn(async () => []),
    exists: vi.fn(async (path: string) => path in store),
    mkdir: vi.fn(async () => {}),
    listEntries: vi.fn(async () => []),
    listFilesRecursive: vi.fn(async () => []),
    deleteFile: vi.fn(async () => {}),
  };
}

// ---------------------------------------------------------------------------
// parseSettings / serializeSettings
// ---------------------------------------------------------------------------

describe('parseSettings', () => {
  it('round-trips a fully populated settings object', () => {
    const settings: Settings = {
      ai: {
        selectedProviderId: 'openai',
        providers: {
          openai: { model: 'gpt-4o-mini' },
          ollama: { model: 'llama3.1', baseUrl: 'http://localhost:11434' },
        },
      },
    };

    const yaml = serializeSettings(settings);
    const parsed = parseSettings(yaml);

    expect(parsed).toEqual(settings);
  });

  it('returns defaults for empty YAML content', () => {
    expect(parseSettings('')).toEqual(defaultSettings());
  });

  it('returns defaults for malformed YAML (not throw)', () => {
    expect(() => parseSettings(':\n  - [unterminated')).not.toThrow();
    expect(parseSettings(':\n  - [unterminated')).toEqual(defaultSettings());
  });

  it('returns defaults when the parsed content fails schema validation', () => {
    // `providers` must be a record of objects, not a string
    const badYaml = 'ai:\n  selectedProviderId: openai\n  providers: "not-a-record"\n';
    expect(parseSettings(badYaml)).toEqual(defaultSettings());
  });

  it('returns defaults for a document that parses to a scalar, not an object', () => {
    expect(parseSettings('just a string')).toEqual(defaultSettings());
  });

  it('tolerates a partial document (missing selectedProviderId)', () => {
    const yaml = 'ai:\n  providers:\n    gemini:\n      model: gemini-2.0-flash\n';
    const parsed = parseSettings(yaml);
    expect(parsed.ai.selectedProviderId).toBeUndefined();
    expect(parsed.ai.providers.gemini).toEqual({ model: 'gemini-2.0-flash' });
  });
});

describe('serializeSettings — secret exclusion', () => {
  it('never emits a key/secret field, even if hypothetically present on the input object', () => {
    const settingsWithSneakyKey = {
      ai: {
        selectedProviderId: 'openai',
        providers: {
          // A hypothetical caller bug that tried to smuggle a key through —
          // assert on the raw YAML string, not just the typed object, since
          // the type system alone doesn't prove the string is clean.
          openai: { model: 'gpt-4o-mini', apiKey: 'sk-should-not-appear' },
        },
      },
      // Also try smuggling a key at the top level.
      apiKey: 'sk-also-should-not-appear',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const yaml = serializeSettings(settingsWithSneakyKey);

    expect(yaml).not.toContain('apiKey');
    expect(yaml).not.toContain('sk-should-not-appear');
    expect(yaml).not.toContain('sk-also-should-not-appear');
    // The legitimate, non-secret field should still be there.
    expect(yaml).toContain('gpt-4o-mini');
  });

  it('produces YAML containing only the expected non-secret keys', () => {
    const settings: Settings = {
      ai: { selectedProviderId: 'ollama', providers: { ollama: { baseUrl: 'http://localhost:11434' } } },
    };
    const yaml = serializeSettings(settings);
    expect(yaml).toContain('selectedProviderId: ollama');
    expect(yaml).toContain('baseUrl: http://localhost:11434');
  });
});

// ---------------------------------------------------------------------------
// loadSettings / saveSettings
// ---------------------------------------------------------------------------

describe('loadSettings', () => {
  it('returns defaults when the file is missing', async () => {
    const fs = makeMockFs();
    const settings = await loadSettings(fs);
    expect(settings).toEqual(defaultSettings());
  });

  it('reads and parses an existing settings.yaml', async () => {
    const yaml = serializeSettings({
      ai: { selectedProviderId: 'gemini', providers: { gemini: { model: 'gemini-2.0-flash' } } },
    });
    const fs = makeMockFs({ '.archcanvas/settings.yaml': yaml });

    const settings = await loadSettings(fs);
    expect(settings.ai.selectedProviderId).toBe('gemini');
    expect(settings.ai.providers.gemini).toEqual({ model: 'gemini-2.0-flash' });
  });

  it('returns defaults when the file exists but is corrupt', async () => {
    const fs = makeMockFs({ '.archcanvas/settings.yaml': ':\n  - [unterminated' });
    const settings = await loadSettings(fs);
    expect(settings).toEqual(defaultSettings());
  });

  it('returns defaults when fs.readFile throws unexpectedly', async () => {
    const fs = makeMockFs();
    fs.exists = vi.fn(async () => true);
    fs.readFile = vi.fn(async () => {
      throw new Error('boom');
    });
    const settings = await loadSettings(fs);
    expect(settings).toEqual(defaultSettings());
  });
});

describe('saveSettings', () => {
  it('writes settings.yaml under .archcanvas/', async () => {
    const fs = makeMockFs();
    const settings: Settings = {
      ai: { selectedProviderId: 'openai', providers: { openai: { model: 'gpt-4o-mini' } } },
    };

    await saveSettings(fs, settings);

    expect(fs.writeFile).toHaveBeenCalledWith('.archcanvas/settings.yaml', expect.stringContaining('gpt-4o-mini'));
  });

  it('round-trips through loadSettings', async () => {
    const fs = makeMockFs();
    const settings: Settings = {
      ai: { selectedProviderId: 'ollama', providers: { ollama: { model: 'llama3.1', baseUrl: 'http://localhost:11434' } } },
    };

    await saveSettings(fs, settings);
    const loaded = await loadSettings(fs);

    expect(loaded).toEqual(settings);
  });
});
