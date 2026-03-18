import { describe, it, expect } from 'vitest';
import { typeToColor } from '@/lib/typeToColor';

describe('typeToColor', () => {
  it('returns a valid CSS HSL color string', () => {
    const color = typeToColor('service');
    expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('is deterministic — same input returns same output', () => {
    expect(typeToColor('database')).toBe(typeToColor('database'));
  });

  it('different types produce different colors', () => {
    const colors = new Set([
      typeToColor('service'),
      typeToColor('database'),
      typeToColor('queue'),
      typeToColor('cache'),
      typeToColor('gateway'),
    ]);
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it('handles empty string', () => {
    const color = typeToColor('');
    expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });
});
