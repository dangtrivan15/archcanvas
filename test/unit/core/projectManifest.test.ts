/**
 * Unit tests for project manifest parsing, validation, and creation.
 */
import { describe, it, expect } from 'vitest';
import {
  parseManifest,
  serializeManifest,
  createManifest,
  PROJECT_MANIFEST_FILENAME,
} from '@/core/project/manifest';

// ─── Valid Manifest Fixture ──────────────────────────────────────

const validManifest = {
  version: 1,
  name: 'My Architecture Project',
  description: 'A multi-service architecture',
  rootFile: 'main.archc',
  files: [
    { path: 'main.archc', displayName: 'Main Architecture' },
    { path: 'auth-service.archc', displayName: 'Auth Service', description: 'Handles authentication' },
    { path: 'api-gateway.archc', displayName: 'API Gateway' },
  ],
  links: [
    { from: 'main.archc', to: 'auth-service.archc', label: 'depends on' },
    { from: 'main.archc', to: 'api-gateway.archc' },
  ],
};

describe('PROJECT_MANIFEST_FILENAME', () => {
  it('should be .archproject.json', () => {
    expect(PROJECT_MANIFEST_FILENAME).toBe('.archproject.json');
  });
});

describe('parseManifest', () => {
  it('should parse a valid manifest', () => {
    const result = parseManifest(validManifest);
    expect(result.version).toBe(1);
    expect(result.name).toBe('My Architecture Project');
    expect(result.description).toBe('A multi-service architecture');
    expect(result.rootFile).toBe('main.archc');
    expect(result.files).toHaveLength(3);
    expect(result.links).toHaveLength(2);
  });

  it('should parse a minimal manifest without optional fields', () => {
    const minimal = {
      version: 1,
      name: 'Minimal',
      rootFile: 'root.archc',
      files: [{ path: 'root.archc', displayName: 'Root' }],
    };
    const result = parseManifest(minimal);
    expect(result.name).toBe('Minimal');
    expect(result.description).toBeUndefined();
    expect(result.links).toHaveLength(0);
  });

  it('should reject non-object input', () => {
    expect(() => parseManifest(null)).toThrow('expected a JSON object');
    expect(() => parseManifest('string')).toThrow('expected a JSON object');
    expect(() => parseManifest([])).toThrow('expected a JSON object');
    expect(() => parseManifest(42)).toThrow('expected a JSON object');
  });

  it('should reject invalid version', () => {
    expect(() => parseManifest({ ...validManifest, version: 2 })).toThrow('version');
    expect(() => parseManifest({ ...validManifest, version: '1' })).toThrow('version');
  });

  it('should reject missing or invalid name', () => {
    expect(() => parseManifest({ ...validManifest, name: '' })).toThrow('"name"');
    expect(() => parseManifest({ ...validManifest, name: 123 })).toThrow('"name"');
    const { name: _, ...noName } = validManifest;
    expect(() => parseManifest(noName)).toThrow('"name"');
  });

  it('should reject invalid description type', () => {
    expect(() => parseManifest({ ...validManifest, description: 123 })).toThrow('"description"');
  });

  it('should reject missing or invalid rootFile', () => {
    expect(() => parseManifest({ ...validManifest, rootFile: '' })).toThrow('"rootFile"');
    expect(() => parseManifest({ ...validManifest, rootFile: 123 })).toThrow('"rootFile"');
  });

  it('should reject rootFile not in files list', () => {
    expect(() =>
      parseManifest({ ...validManifest, rootFile: 'nonexistent.archc' }),
    ).toThrow('not listed in files[]');
  });

  it('should reject invalid files array', () => {
    expect(() => parseManifest({ ...validManifest, files: 'not-array' })).toThrow('"files"');
  });

  it('should reject file entry without path', () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        files: [{ displayName: 'Test' }],
      }),
    ).toThrow('files[0].path');
  });

  it('should reject file entry without displayName', () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        files: [{ path: 'test.archc' }],
      }),
    ).toThrow('files[0].displayName');
  });

  it('should reject link with from not in files', () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        links: [{ from: 'unknown.archc', to: 'main.archc' }],
      }),
    ).toThrow('links[0].from');
  });

  it('should reject link with to not in files', () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        links: [{ from: 'main.archc', to: 'unknown.archc' }],
      }),
    ).toThrow('links[0].to');
  });

  it('should reject link without from', () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        links: [{ to: 'main.archc' }],
      }),
    ).toThrow('links[0].from');
  });

  it('should reject link without to', () => {
    expect(() =>
      parseManifest({
        ...validManifest,
        links: [{ from: 'main.archc' }],
      }),
    ).toThrow('links[0].to');
  });

  it('should preserve optional description on file entries', () => {
    const result = parseManifest(validManifest);
    expect(result.files[1]!.description).toBe('Handles authentication');
    expect(result.files[0]!.description).toBeUndefined();
  });

  it('should preserve optional label on links', () => {
    const result = parseManifest(validManifest);
    expect(result.links[0]!.label).toBe('depends on');
    expect(result.links[1]!.label).toBeUndefined();
  });
});

describe('serializeManifest', () => {
  it('should produce valid JSON with trailing newline', () => {
    const manifest = parseManifest(validManifest);
    const json = serializeManifest(manifest);
    expect(json.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe('My Architecture Project');
  });

  it('should round-trip through parse and serialize', () => {
    const original = parseManifest(validManifest);
    const serialized = serializeManifest(original);
    const reparsed = parseManifest(JSON.parse(serialized));
    expect(reparsed).toEqual(original);
  });
});

describe('createManifest', () => {
  it('should create a manifest from file paths', () => {
    const manifest = createManifest('Test Project', ['main.archc', 'sub.archc']);
    expect(manifest.version).toBe(1);
    expect(manifest.name).toBe('Test Project');
    expect(manifest.rootFile).toBe('main.archc');
    expect(manifest.files).toHaveLength(2);
    expect(manifest.links).toHaveLength(0);
  });

  it('should use the first file as root by default', () => {
    const manifest = createManifest('P', ['alpha.archc', 'beta.archc']);
    expect(manifest.rootFile).toBe('alpha.archc');
  });

  it('should accept explicit root file', () => {
    const manifest = createManifest('P', ['a.archc', 'b.archc'], 'b.archc');
    expect(manifest.rootFile).toBe('b.archc');
  });

  it('should derive displayName from filename', () => {
    const manifest = createManifest('P', ['api-gateway.archc']);
    expect(manifest.files[0]!.displayName).toBe('api-gateway');
  });

  it('should throw for empty file list', () => {
    expect(() => createManifest('P', [])).toThrow('no .archc files');
  });

  it('should throw for rootFile not in list', () => {
    expect(() => createManifest('P', ['a.archc'], 'b.archc')).toThrow('not in the file list');
  });

  it('should produce a valid manifest (round-trips through parseManifest)', () => {
    const manifest = createManifest('Test', ['main.archc', 'db.archc']);
    const reparsed = parseManifest(manifest);
    expect(reparsed).toEqual(manifest);
  });
});
