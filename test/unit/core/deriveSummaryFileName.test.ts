/**
 * Feature #156: Save auto-generates .summary.md sidecar file.
 * Verifies that deriveSummaryFileName correctly derives the .summary.md
 * filename from .archc filenames.
 */
import { describe, it, expect } from 'vitest';
import { deriveSummaryFileName } from '@/core/storage/fileIO';

describe('deriveSummaryFileName() - Feature #156', () => {
  it('converts .archc to .summary.md', () => {
    expect(deriveSummaryFileName('my-project.archc')).toBe('my-project.summary.md');
  });

  it('handles simple filename', () => {
    expect(deriveSummaryFileName('architecture.archc')).toBe('architecture.summary.md');
  });

  it('handles filename with multiple dots', () => {
    expect(deriveSummaryFileName('my.project.v2.archc')).toBe('my.project.v2.summary.md');
  });

  it('handles filename without .archc extension (no-op)', () => {
    // If no .archc extension, appends .summary.md-like behavior won't work
    // deriveSummaryFileName only replaces .archc suffix
    expect(deriveSummaryFileName('noextension')).toBe('noextension');
  });

  it('handles filename with spaces', () => {
    expect(deriveSummaryFileName('my project.archc')).toBe('my project.summary.md');
  });

  it('handles ecommerce.archc example', () => {
    expect(deriveSummaryFileName('ecommerce.archc')).toBe('ecommerce.summary.md');
  });
});
