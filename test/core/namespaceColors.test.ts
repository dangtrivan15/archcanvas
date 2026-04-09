import { describe, it, expect } from 'vitest';
import {
  extractNamespace,
  BUILT_IN_NAMESPACES,
  type BuiltInNamespace,
} from '@/core/namespaceColors';

describe('BUILT_IN_NAMESPACES', () => {
  it('contains exactly 9 namespaces', () => {
    expect(BUILT_IN_NAMESPACES).toHaveLength(9);
  });

  it('includes all expected namespaces', () => {
    const expected = [
      'compute', 'data', 'messaging', 'network', 'client',
      'integration', 'security', 'observability', 'ai',
    ];
    expect([...BUILT_IN_NAMESPACES]).toEqual(expected);
  });
});

describe('extractNamespace', () => {
  it.each<[string, BuiltInNamespace]>([
    ['compute/service', 'compute'],
    ['data/database', 'data'],
    ['messaging/event-bus', 'messaging'],
    ['network/api-gateway', 'network'],
    ['client/web-app', 'client'],
    ['integration/webhook', 'integration'],
    ['security/vault', 'security'],
    ['observability/logging', 'observability'],
    ['ai/llm-provider', 'ai'],
  ])('extracts namespace from "%s" → "%s"', (type, expected) => {
    expect(extractNamespace(type)).toBe(expected);
  });

  it('returns undefined for type with no slash', () => {
    expect(extractNamespace('foobar')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(extractNamespace('')).toBeUndefined();
  });

  it('returns undefined for unknown namespace prefix', () => {
    expect(extractNamespace('custom/widget')).toBeUndefined();
  });

  it('returns undefined when slash is at position 0', () => {
    expect(extractNamespace('/something')).toBeUndefined();
  });

  it('handles types with multiple slashes', () => {
    expect(extractNamespace('compute/service/variant')).toBe('compute');
  });
});
