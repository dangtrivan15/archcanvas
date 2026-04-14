import { describe, it, expect } from 'vitest';
import {
  parseSemVer,
  parseVersionConstraint,
  parseTypeRef,
  versionSatisfies,
  compareSemVer,
  formatSemVer,
  formatConstraint,
} from '@/core/registry/version';

describe('parseSemVer', () => {
  it('parses valid semver string', () => {
    expect(parseSemVer('1.0.0')).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it('parses zero version', () => {
    expect(parseSemVer('0.0.1')).toEqual({ major: 0, minor: 0, patch: 1 });
  });

  it('parses large numbers', () => {
    expect(parseSemVer('99.99.99')).toEqual({ major: 99, minor: 99, patch: 99 });
  });

  it('returns null for incomplete semver', () => {
    expect(parseSemVer('1.0')).toBeNull();
  });

  it('returns null for pre-release suffix', () => {
    expect(parseSemVer('1.0.0-beta')).toBeNull();
  });

  it('returns null for non-numeric', () => {
    expect(parseSemVer('abc')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSemVer('')).toBeNull();
  });
});

describe('parseVersionConstraint', () => {
  it('parses exact constraint', () => {
    expect(parseVersionConstraint('1.2.3')).toEqual({
      type: 'exact',
      version: { major: 1, minor: 2, patch: 3 },
    });
  });

  it('parses caret constraint', () => {
    expect(parseVersionConstraint('^1.2.3')).toEqual({
      type: 'caret',
      version: { major: 1, minor: 2, patch: 3 },
    });
  });

  it('parses tilde constraint', () => {
    expect(parseVersionConstraint('~1.2.3')).toEqual({
      type: 'tilde',
      version: { major: 1, minor: 2, patch: 3 },
    });
  });

  it('returns null for invalid constraint', () => {
    expect(parseVersionConstraint('^abc')).toBeNull();
  });

  it('returns null for range syntax', () => {
    expect(parseVersionConstraint('>=1.0.0')).toBeNull();
  });
});

describe('parseTypeRef', () => {
  it('parses bare type key', () => {
    expect(parseTypeRef('data/database')).toEqual({
      typeKey: 'data/database',
      constraint: undefined,
    });
  });

  it('parses versioned type with caret', () => {
    expect(parseTypeRef('data/database@^1.0.0')).toEqual({
      typeKey: 'data/database',
      constraint: {
        type: 'caret',
        version: { major: 1, minor: 0, patch: 0 },
      },
    });
  });

  it('parses versioned type with exact version', () => {
    expect(parseTypeRef('data/database@1.2.3')).toEqual({
      typeKey: 'data/database',
      constraint: {
        type: 'exact',
        version: { major: 1, minor: 2, patch: 3 },
      },
    });
  });

  it('parses versioned type with tilde', () => {
    expect(parseTypeRef('data/database@~1.0.0')).toEqual({
      typeKey: 'data/database',
      constraint: {
        type: 'tilde',
        version: { major: 1, minor: 0, patch: 0 },
      },
    });
  });

  it('returns undefined constraint for invalid version suffix', () => {
    expect(parseTypeRef('data/database@abc')).toEqual({
      typeKey: 'data/database',
      constraint: undefined,
    });
  });
});

describe('versionSatisfies', () => {
  describe('exact', () => {
    const constraint = { type: 'exact' as const, version: { major: 1, minor: 0, patch: 0 } };

    it('matches exact version', () => {
      expect(versionSatisfies({ major: 1, minor: 0, patch: 0 }, constraint)).toBe(true);
    });

    it('rejects different patch', () => {
      expect(versionSatisfies({ major: 1, minor: 0, patch: 1 }, constraint)).toBe(false);
    });

    it('rejects different minor', () => {
      expect(versionSatisfies({ major: 1, minor: 1, patch: 0 }, constraint)).toBe(false);
    });

    it('rejects different major', () => {
      expect(versionSatisfies({ major: 2, minor: 0, patch: 0 }, constraint)).toBe(false);
    });
  });

  describe('caret', () => {
    const constraint = { type: 'caret' as const, version: { major: 1, minor: 0, patch: 0 } };

    it('matches same version', () => {
      expect(versionSatisfies({ major: 1, minor: 0, patch: 0 }, constraint)).toBe(true);
    });

    it('matches higher minor', () => {
      expect(versionSatisfies({ major: 1, minor: 2, patch: 3 }, constraint)).toBe(true);
    });

    it('matches higher patch', () => {
      expect(versionSatisfies({ major: 1, minor: 0, patch: 5 }, constraint)).toBe(true);
    });

    it('rejects different major', () => {
      expect(versionSatisfies({ major: 2, minor: 0, patch: 0 }, constraint)).toBe(false);
    });

    it('rejects lower minor', () => {
      const c = { type: 'caret' as const, version: { major: 1, minor: 2, patch: 0 } };
      expect(versionSatisfies({ major: 1, minor: 1, patch: 9 }, c)).toBe(false);
    });

    it('rejects lower patch with same minor', () => {
      const c = { type: 'caret' as const, version: { major: 1, minor: 2, patch: 5 } };
      expect(versionSatisfies({ major: 1, minor: 2, patch: 4 }, c)).toBe(false);
    });

    describe('major=0 special case', () => {
      const c = { type: 'caret' as const, version: { major: 0, minor: 1, patch: 0 } };

      it('matches same minor and equal patch', () => {
        expect(versionSatisfies({ major: 0, minor: 1, patch: 0 }, c)).toBe(true);
      });

      it('matches same minor and higher patch', () => {
        expect(versionSatisfies({ major: 0, minor: 1, patch: 5 }, c)).toBe(true);
      });

      it('rejects different minor', () => {
        expect(versionSatisfies({ major: 0, minor: 2, patch: 1 }, c)).toBe(false);
      });

      it('rejects lower patch', () => {
        const c2 = { type: 'caret' as const, version: { major: 0, minor: 1, patch: 2 } };
        expect(versionSatisfies({ major: 0, minor: 1, patch: 1 }, c2)).toBe(false);
      });
    });
  });

  describe('tilde', () => {
    const constraint = { type: 'tilde' as const, version: { major: 1, minor: 2, patch: 0 } };

    it('matches same version', () => {
      expect(versionSatisfies({ major: 1, minor: 2, patch: 0 }, constraint)).toBe(true);
    });

    it('matches higher patch', () => {
      expect(versionSatisfies({ major: 1, minor: 2, patch: 5 }, constraint)).toBe(true);
    });

    it('rejects different minor', () => {
      expect(versionSatisfies({ major: 1, minor: 3, patch: 0 }, constraint)).toBe(false);
    });

    it('rejects different major', () => {
      expect(versionSatisfies({ major: 2, minor: 2, patch: 0 }, constraint)).toBe(false);
    });

    it('rejects lower patch', () => {
      const c = { type: 'tilde' as const, version: { major: 1, minor: 2, patch: 3 } };
      expect(versionSatisfies({ major: 1, minor: 2, patch: 2 }, c)).toBe(false);
    });
  });
});

describe('compareSemVer', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemVer({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 })).toBe(0);
  });

  it('returns -1 for lower major', () => {
    expect(compareSemVer({ major: 1, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 0 })).toBe(-1);
  });

  it('returns 1 for higher major', () => {
    expect(compareSemVer({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 })).toBe(1);
  });

  it('returns -1 for lower minor', () => {
    expect(compareSemVer({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 1, patch: 0 })).toBe(-1);
  });

  it('returns -1 for lower patch', () => {
    expect(compareSemVer({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 1 })).toBe(-1);
  });
});

describe('formatSemVer', () => {
  it('formats a SemVer to string', () => {
    expect(formatSemVer({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
  });

  it('round-trips with parseSemVer', () => {
    const original = '3.14.159';
    const parsed = parseSemVer(original)!;
    expect(formatSemVer(parsed)).toBe(original);
  });
});

describe('formatConstraint', () => {
  it('formats exact constraint', () => {
    expect(formatConstraint({
      type: 'exact',
      version: { major: 1, minor: 2, patch: 3 },
    })).toBe('1.2.3');
  });

  it('formats caret constraint', () => {
    expect(formatConstraint({
      type: 'caret',
      version: { major: 1, minor: 2, patch: 3 },
    })).toBe('^1.2.3');
  });

  it('formats tilde constraint', () => {
    expect(formatConstraint({
      type: 'tilde',
      version: { major: 1, minor: 2, patch: 3 },
    })).toBe('~1.2.3');
  });

  it('round-trips with parseVersionConstraint', () => {
    const constraints = ['^1.0.0', '~2.3.4', '0.1.0'];
    for (const str of constraints) {
      const parsed = parseVersionConstraint(str)!;
      expect(formatConstraint(parsed)).toBe(str);
    }
  });
});
