import { describe, it, expect } from 'vitest';
import { deriveId } from '@/lib/deriveId';

describe('deriveId', () => {
  it('converts display name to kebab-case', () => {
    expect(deriveId('Order Service')).toBe('order-service');
  });

  it('strips leading/trailing special characters', () => {
    expect(deriveId('  --Hello World!! ')).toBe('hello-world');
  });

  it('strips non-ASCII characters', () => {
    expect(deriveId('café')).toBe('caf');
  });

  it('returns empty string for empty input', () => {
    expect(deriveId('')).toBe('');
  });

  it('collapses multiple separators into one dash', () => {
    expect(deriveId('foo---bar___baz')).toBe('foo-bar-baz');
  });
});
