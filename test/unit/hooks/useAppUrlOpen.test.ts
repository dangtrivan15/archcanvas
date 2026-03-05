/**
 * Tests for src/hooks/useAppUrlOpen.ts
 *
 * Feature #292: Register .archc file type association on iOS
 *
 * Verifies:
 * 1. extractFileName correctly parses file:// URLs and paths
 * 2. isArchcFileUrl detects .archc extension correctly
 * 3. handleFileUrl reads + decodes + applies file data
 * 4. Info.plist has correct UTI, Document Type, and LSSupportsOpeningDocumentsInPlace
 * 5. Hook behavior on native vs web
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractFileName, isArchcFileUrl, handleFileUrl } from '@/hooks/useAppUrlOpen';
import * as fs from 'fs';
import * as path from 'path';

// ─── extractFileName Tests ─────────────────────────────────

describe('Feature #292: extractFileName', () => {
  it('extracts filename from a simple path', () => {
    expect(extractFileName('/var/mobile/Documents/MyProject.archc')).toBe('MyProject.archc');
  });

  it('extracts filename from a file:// URL', () => {
    expect(
      extractFileName('file:///var/mobile/Containers/Data/Application/UUID/Documents/arch.archc'),
    ).toBe('arch.archc');
  });

  it('handles URL-encoded characters', () => {
    expect(extractFileName('file:///path/to/My%20Project.archc')).toBe('My Project.archc');
  });

  it('returns "Opened File" for empty path', () => {
    expect(extractFileName('')).toBe('Opened File');
  });

  it('returns "Opened File" for path ending in slash', () => {
    expect(extractFileName('/some/dir/')).toBe('Opened File');
  });

  it('handles complex nested paths', () => {
    expect(
      extractFileName(
        'file:///private/var/mobile/Containers/Data/Application/ABC123/Documents/ArchCanvas/test-file.archc',
      ),
    ).toBe('test-file.archc');
  });

  it('handles content:// URIs (Android-style, future-proofing)', () => {
    expect(extractFileName('content://com.example.provider/documents/file.archc')).toBe(
      'file.archc',
    );
  });
});

// ─── isArchcFileUrl Tests ──────────────────────────────────

describe('Feature #292: isArchcFileUrl', () => {
  it('returns true for .archc file URL', () => {
    expect(isArchcFileUrl('file:///path/to/project.archc')).toBe(true);
  });

  it('returns true for .archc path (no scheme)', () => {
    expect(isArchcFileUrl('/var/mobile/Documents/test.archc')).toBe(true);
  });

  it('returns true for URL-encoded .archc', () => {
    expect(isArchcFileUrl('file:///path/to/My%20Project.archc')).toBe(true);
  });

  it('returns true for .ARCHC (case-insensitive)', () => {
    expect(isArchcFileUrl('file:///path/test.ARCHC')).toBe(true);
  });

  it('returns false for .txt file', () => {
    expect(isArchcFileUrl('file:///path/to/notes.txt')).toBe(false);
  });

  it('returns false for .archc.bak file', () => {
    expect(isArchcFileUrl('file:///path/to/project.archc.bak')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isArchcFileUrl('')).toBe(false);
  });

  it('strips query params before checking extension', () => {
    expect(isArchcFileUrl('file:///path/to/file.archc?token=abc')).toBe(true);
  });

  it('strips fragment before checking extension', () => {
    expect(isArchcFileUrl('file:///path/to/file.archc#section')).toBe(true);
  });

  it('returns false for URL with .archc only in query params', () => {
    expect(isArchcFileUrl('file:///path/to/file.txt?name=test.archc')).toBe(false);
  });
});

// ─── handleFileUrl Tests ───────────────────────────────────

describe('Feature #292: handleFileUrl', () => {
  let mockApplyDecodedFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockApplyDecodedFile = vi.fn();
  });

  it('reads file, decodes, and applies to store on success', async () => {
    // Mock @capacitor/filesystem
    const mockFileData = btoa('test-binary-data');
    vi.doMock('@capacitor/filesystem', () => ({
      Filesystem: {
        readFile: vi.fn().mockResolvedValue({ data: mockFileData }),
      },
    }));

    // Mock decodeArchcData
    const mockGraph = { name: 'Test', description: '', owners: [], nodes: [], edges: [] };
    vi.doMock('@/core/storage/fileIO', () => ({
      decodeArchcData: vi.fn().mockResolvedValue({
        graph: mockGraph,
        canvasState: undefined,
        aiState: undefined,
        createdAtMs: 1234567890,
      }),
    }));

    // Re-import to pick up mocks
    const { handleFileUrl: handleFileUrlMocked } = await import('@/hooks/useAppUrlOpen');

    const result = await handleFileUrlMocked('file:///path/to/project.archc', mockApplyDecodedFile);

    expect(result).toBe(true);
    expect(mockApplyDecodedFile).toHaveBeenCalledWith(
      mockGraph,
      'project.archc',
      'file:///path/to/project.archc',
      undefined,
      undefined,
      1234567890,
    );

    vi.doUnmock('@capacitor/filesystem');
    vi.doUnmock('@/core/storage/fileIO');
  });

  it('returns false when file read fails', async () => {
    vi.doMock('@capacitor/filesystem', () => ({
      Filesystem: {
        readFile: vi.fn().mockRejectedValue(new Error('File not found')),
      },
    }));

    const { handleFileUrl: handleFileUrlMocked } = await import('@/hooks/useAppUrlOpen');

    const result = await handleFileUrlMocked(
      'file:///path/to/nonexistent.archc',
      mockApplyDecodedFile,
    );

    expect(result).toBe(false);
    expect(mockApplyDecodedFile).not.toHaveBeenCalled();

    vi.doUnmock('@capacitor/filesystem');
  });

  it('returns false when decode fails', async () => {
    const mockFileData = btoa('invalid-data');
    vi.doMock('@capacitor/filesystem', () => ({
      Filesystem: {
        readFile: vi.fn().mockResolvedValue({ data: mockFileData }),
      },
    }));

    vi.doMock('@/core/storage/fileIO', () => ({
      decodeArchcData: vi.fn().mockRejectedValue(new Error('Invalid protobuf')),
    }));

    const { handleFileUrl: handleFileUrlMocked } = await import('@/hooks/useAppUrlOpen');

    const result = await handleFileUrlMocked('file:///path/to/corrupt.archc', mockApplyDecodedFile);

    expect(result).toBe(false);
    expect(mockApplyDecodedFile).not.toHaveBeenCalled();

    vi.doUnmock('@capacitor/filesystem');
    vi.doUnmock('@/core/storage/fileIO');
  });
});

// ─── Info.plist Configuration Tests ────────────────────────

describe('Feature #292: Info.plist .archc file type configuration', () => {
  let plistContent: string;

  beforeEach(() => {
    const plistPath = path.resolve(__dirname, '../../../ios/App/App/Info.plist');
    plistContent = fs.readFileSync(plistPath, 'utf-8');
  });

  it('contains Exported UTI declaration for com.archcanvas.archc', () => {
    expect(plistContent).toContain('UTExportedTypeDeclarations');
    expect(plistContent).toContain('com.archcanvas.archc');
  });

  it('Exported UTI conforms to public.data', () => {
    expect(plistContent).toContain('UTTypeConformsTo');
    expect(plistContent).toContain('public.data');
  });

  it('Exported UTI specifies archc file extension', () => {
    expect(plistContent).toContain('public.filename-extension');
    expect(plistContent).toContain('<string>archc</string>');
  });

  it('Exported UTI has description', () => {
    expect(plistContent).toContain('UTTypeDescription');
    expect(plistContent).toContain('ArchCanvas Architecture File');
  });

  it('contains Document Type for ArchCanvas Architecture', () => {
    expect(plistContent).toContain('CFBundleDocumentTypes');
    expect(plistContent).toContain('ArchCanvas Architecture');
  });

  it('Document Type references com.archcanvas.archc UTI', () => {
    expect(plistContent).toContain('LSItemContentTypes');
    // The UTI should appear in both UTExportedTypeDeclarations and CFBundleDocumentTypes
    const utiOccurrences = plistContent.split('com.archcanvas.archc').length - 1;
    expect(utiOccurrences).toBeGreaterThanOrEqual(2);
  });

  it('Document Type role is Editor', () => {
    expect(plistContent).toContain('CFBundleTypeRole');
    expect(plistContent).toContain('<string>Editor</string>');
  });

  it('Document Type handler rank is Owner', () => {
    expect(plistContent).toContain('LSHandlerRank');
    expect(plistContent).toContain('<string>Owner</string>');
  });

  it('has LSSupportsOpeningDocumentsInPlace set to true', () => {
    expect(plistContent).toContain('LSSupportsOpeningDocumentsInPlace');
    // Check that the value after the key is <true/>
    const keyIndex = plistContent.indexOf('LSSupportsOpeningDocumentsInPlace');
    const afterKey = plistContent.substring(keyIndex);
    const trueMatch = afterKey.match(/<\/key>\s*\n\s*<true\/>/);
    expect(trueMatch).not.toBeNull();
  });

  it('has UTTypeIdentifier key in exported UTI', () => {
    expect(plistContent).toContain('UTTypeIdentifier');
  });

  it('has UTTypeTagSpecification with file extension mapping', () => {
    expect(plistContent).toContain('UTTypeTagSpecification');
  });
});

// ─── Capacitor App Plugin Registration Tests ───────────────

describe('Feature #292: Capacitor App plugin available', () => {
  it('@capacitor/app package is installed', () => {
    // Verify the package can be imported (it's installed in node_modules)
    const appModule = require('@capacitor/app');
    expect(appModule).toBeDefined();
    expect(appModule.App).toBeDefined();
  });
});

// ─── Hook Behavior (web vs native) ─────────────────────────

describe('Feature #292: useAppUrlOpen web behavior', () => {
  it('isNative returns false on web (hook is no-op)', async () => {
    // On web/test environment, isNative() should return false
    const { isNative } = await import('@/core/platform/platformBridge');
    // In test env, Capacitor is not native
    expect(isNative()).toBe(false);
  });

  it('extractFileName handles deeply nested iOS paths', () => {
    const url =
      'file:///private/var/mobile/Library/Mobile%20Documents/com~apple~CloudDocs/ArchCanvas/My%20Architecture.archc';
    expect(extractFileName(url)).toBe('My Architecture.archc');
  });
});
