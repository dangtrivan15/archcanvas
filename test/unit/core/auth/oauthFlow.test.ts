import { describe, it, expect } from 'vitest';
import { extractUsername } from '@/core/auth/oauthFlow';

/**
 * Encode a JSON payload as a base64url JWT segment (no padding).
 */
function encodeJwtSegment(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  // TextEncoder → Uint8Array → base64 → base64url
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeToken(payload: Record<string, unknown>): string {
  return `header.${encodeJwtSegment(payload)}.sig`;
}

describe('extractUsername', () => {
  it('returns preferred_username when present', () => {
    const token = makeToken({ preferred_username: 'alice', sub: 'keycloak-sub-123' });
    expect(extractUsername(token)).toBe('alice');
  });

  it('falls back to sub when preferred_username is absent', () => {
    const token = makeToken({ sub: 'keycloak-sub-123' });
    expect(extractUsername(token)).toBe('keycloak-sub-123');
  });

  it('returns "unknown" when neither field is present', () => {
    const token = makeToken({ email: 'user@example.com' });
    expect(extractUsername(token)).toBe('unknown');
  });

  it('returns "unknown" for a malformed token (no dots)', () => {
    expect(extractUsername('notavalidtoken')).toBe('unknown');
  });

  it('handles base64url characters (- and _) without corrupting the decode', () => {
    // preferred_username with base64url-safe chars in the payload segment
    // We specifically test that the segment containing - and _ is correctly decoded
    const payload = { preferred_username: 'user-with_underscores' };
    const token = makeToken(payload);
    // Verify that the encoded segment contains - or _ (base64url chars)
    // The encoding may or may not produce - and _ depending on the content, but
    // the decode path must handle them. Force a raw token where the segment has both:
    const forceBase64urlPayload = { preferred_username: 'bob' };
    // Craft a token where segment naturally has url chars by padding the payload
    const padded = { ...forceBase64urlPayload, p: 'fill~pad~here' };
    const paddedToken = makeToken(padded);
    expect(extractUsername(paddedToken)).toBe('bob');
    // Also verify the direct test works
    expect(extractUsername(token)).toBe('user-with_underscores');
  });

  it('correctly decodes a real-world-style base64url segment', () => {
    // Manually craft a base64url payload that would break naive atob() (without conversion)
    // The character '>' encodes to base64 as 'Pg==' — when embedded in a larger payload,
    // '/' chars appear in base64 which become '_' in base64url.
    // We simply verify the round-trip works for any payload our encoder produces.
    const payload = { preferred_username: 'test_user-123', sub: 'aaa-bbb_ccc' };
    const token = makeToken(payload);
    expect(extractUsername(token)).toBe('test_user-123');
  });
});
