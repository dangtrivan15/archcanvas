import { describe, it, expect } from 'vitest';
import {
  validateRelativePath,
  globToRegex,
  isBinaryContent,
  truncateLines,
  DEFAULT_IGNORE,
  shouldIgnore,
} from '../../src/core/ai/fileToolUtils';

describe('validateRelativePath', () => {
  it('accepts simple relative paths', () => {
    expect(validateRelativePath('src/app.ts')).toBe('src/app.ts');
    expect(validateRelativePath('README.md')).toBe('README.md');
  });

  it('rejects paths with .. traversal', () => {
    expect(() => validateRelativePath('../etc/passwd')).toThrow('Path traversal');
    expect(() => validateRelativePath('src/../../etc')).toThrow('Path traversal');
  });

  it('rejects absolute paths', () => {
    expect(() => validateRelativePath('/etc/passwd')).toThrow('Absolute path');
    expect(() => validateRelativePath('C:\\Windows')).toThrow('Absolute path');
  });

  it('normalizes separators', () => {
    expect(validateRelativePath('src\\lib\\utils.ts')).toBe('src/lib/utils.ts');
  });

  it('strips leading ./', () => {
    expect(validateRelativePath('./src/app.ts')).toBe('src/app.ts');
  });
});

describe('globToRegex', () => {
  it('matches * (single segment wildcard)', () => {
    const re = globToRegex('*.ts');
    expect(re.test('app.ts')).toBe(true);
    expect(re.test('src/app.ts')).toBe(false); // * doesn't cross /
  });

  it('matches ** (recursive wildcard)', () => {
    const re = globToRegex('**/*.ts');
    expect(re.test('app.ts')).toBe(true);
    expect(re.test('src/app.ts')).toBe(true);
    expect(re.test('src/lib/utils.ts')).toBe(true);
  });

  it('matches ? (single character)', () => {
    const re = globToRegex('app.?s');
    expect(re.test('app.ts')).toBe(true);
    expect(re.test('app.js')).toBe(true);
    expect(re.test('app.css')).toBe(false);
  });

  it('matches specific directory prefix', () => {
    const re = globToRegex('src/**/*.tsx');
    expect(re.test('src/App.tsx')).toBe(true);
    expect(re.test('src/components/Chat.tsx')).toBe(true);
    expect(re.test('test/App.tsx')).toBe(false);
  });
});

describe('isBinaryContent', () => {
  it('returns false for text content', () => {
    expect(isBinaryContent('Hello, world!\nconsole.log("test");')).toBe(false);
  });

  it('returns true for content with null bytes', () => {
    expect(isBinaryContent('ELF\x00\x01\x02')).toBe(true);
  });
});

describe('truncateLines', () => {
  it('returns content unchanged if under limit', () => {
    expect(truncateLines('line1\nline2\nline3', 10)).toBe('line1\nline2\nline3');
  });

  it('truncates and adds message', () => {
    const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = truncateLines(content, 10);
    const lines = result.split('\n');
    expect(lines.length).toBe(11); // 10 lines + truncation message
    expect(lines[10]).toContain('truncated');
    expect(lines[10]).toContain('90');
  });
});

describe('shouldIgnore', () => {
  it('ignores default directories', () => {
    expect(shouldIgnore('node_modules')).toBe(true);
    expect(shouldIgnore('.git')).toBe(true);
    expect(shouldIgnore('dist')).toBe(true);
    expect(shouldIgnore('.archcanvas')).toBe(true);
  });

  it('allows normal directories', () => {
    expect(shouldIgnore('src')).toBe(false);
    expect(shouldIgnore('test')).toBe(false);
  });
});

describe('DEFAULT_IGNORE', () => {
  it('contains expected entries', () => {
    expect(DEFAULT_IGNORE).toContain('node_modules');
    expect(DEFAULT_IGNORE).toContain('.git');
    expect(DEFAULT_IGNORE).toContain('dist');
    expect(DEFAULT_IGNORE).toContain('build');
    expect(DEFAULT_IGNORE).toContain('.archcanvas');
  });
});
