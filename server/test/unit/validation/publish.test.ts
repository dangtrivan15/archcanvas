import { describe, it, expect } from 'vitest';
import { validateSemver } from '../../../src/validation/publish';

describe('validateSemver', () => {
  it('accepts valid semver strings', () => {
    expect(validateSemver('1.0.0')).toBe(true);
    expect(validateSemver('0.1.0')).toBe(true);
    expect(validateSemver('10.20.30')).toBe(true);
    expect(validateSemver('1.0.0-alpha')).toBe(true);
    expect(validateSemver('1.0.0-beta.1')).toBe(true);
    expect(validateSemver('1.0.0+build.123')).toBe(true);
  });

  it('rejects invalid semver strings', () => {
    expect(validateSemver('1.0')).toBe(false);
    expect(validateSemver('1')).toBe(false);
    expect(validateSemver('latest')).toBe(false);
    expect(validateSemver('')).toBe(false);
    expect(validateSemver('v1.0.0')).toBe(false);
    expect(validateSemver('1.0.0.0')).toBe(false);
  });
});
