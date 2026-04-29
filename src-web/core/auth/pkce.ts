/**
 * PKCE (Proof Key for Code Exchange) utilities — RFC 7636.
 * Uses Web Crypto API, available in all modern browsers and Tauri WebView.
 */

/** Generate a cryptographically random code_verifier (43 chars, 32 random bytes base64url-encoded). */
export async function generateCodeVerifier(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** Derive SHA-256 code_challenge from a code_verifier. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** Generate a random state string for CSRF protection (22 chars, 16 bytes). */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
