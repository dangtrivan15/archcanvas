import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/core/auth/pkce';

const BASE64URL_RE = /^[A-Za-z0-9\-_]+$/;

describe('generateCodeVerifier', () => {
  it('returns a string of length 43 (32 bytes base64url-encoded)', async () => {
    const verifier = await generateCodeVerifier();
    expect(verifier).toHaveLength(43);
  });

  it('uses only base64url-safe characters (no +, /, or =)', async () => {
    const verifier = await generateCodeVerifier();
    expect(BASE64URL_RE.test(verifier)).toBe(true);
  });

  it('returns different values on each call (random)', async () => {
    const a = await generateCodeVerifier();
    const b = await generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('generateCodeChallenge', () => {
  it('returns a non-empty string of base64url-safe characters', async () => {
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge.length).toBeGreaterThan(0);
    expect(BASE64URL_RE.test(challenge)).toBe(true);
  });

  it('is deterministic: same verifier produces same challenge', async () => {
    const verifier = await generateCodeVerifier();
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it('produces different challenges for different verifiers', async () => {
    const v1 = await generateCodeVerifier();
    const v2 = await generateCodeVerifier();
    const c1 = await generateCodeChallenge(v1);
    const c2 = await generateCodeChallenge(v2);
    expect(c1).not.toBe(c2);
  });
});

describe('generateState', () => {
  it('returns a non-empty string of base64url-safe characters', () => {
    const state = generateState();
    expect(state.length).toBeGreaterThan(0);
    expect(BASE64URL_RE.test(state)).toBe(true);
  });

  it('returns different values on each call (random)', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});
