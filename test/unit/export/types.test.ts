import { describe, it, expect } from 'vitest';
import { ExportError } from '@/export/types';

describe('ExportError', () => {
  it('has the correct name', () => {
    const err = new ExportError('test', 'EMPTY_CANVAS');
    expect(err.name).toBe('ExportError');
  });

  it('has the correct code', () => {
    const err = new ExportError('test', 'NO_VIEWPORT');
    expect(err.code).toBe('NO_VIEWPORT');
  });

  it('has the correct message', () => {
    const err = new ExportError('Something went wrong', 'RENDER_FAILED');
    expect(err.message).toBe('Something went wrong');
  });

  it('is an instance of Error', () => {
    const err = new ExportError('test', 'UNKNOWN');
    expect(err).toBeInstanceOf(Error);
  });
});
