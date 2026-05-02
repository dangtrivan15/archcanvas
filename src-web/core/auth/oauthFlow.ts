import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce';

const POPUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const POPUP_CLOSED_POLL_MS = 500;

export class OAuthError extends Error {
  constructor(
    public readonly kind:
      | 'popup_blocked'
      | 'timeout'
      | 'cancelled'
      | 'state_mismatch'
      | 'server_error',
    message: string,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export interface OAuthResult {
  code: string;
  verifier: string;
}

/**
 * Open an OAuth PKCE popup and resolve with {code, verifier} when the user
 * completes authentication.
 *
 * The verifier is NOT written to localStorage — it lives entirely in the closure.
 * The popup+postMessage flow is single-session; there is no cross-page handoff
 * that would require out-of-band verifier storage.
 *
 * If the user manually closes the popup, the interval detects popup.closed and
 * rejects with OAuthError('cancelled') within ~500 ms.
 */
export async function startOAuthPKCE(
  keycloakUrl: string,
  realm: string,
  clientId: string,
): Promise<OAuthResult> {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  const redirectUri = `${window.location.origin}/oauth-callback.html`;
  const authUrl = new URL(
    `${keycloakUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/auth`,
  );
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const popup = window.open(
    authUrl.toString(),
    'archcanvas-oauth',
    'width=600,height=700,menubar=no,toolbar=no,resizable=yes',
  );

  if (!popup) {
    throw new OAuthError(
      'popup_blocked',
      'Popup was blocked. Please allow popups for this site and try again.',
    );
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let closedPollId: ReturnType<typeof setInterval> | null = null;
  let messageHandler: ((e: MessageEvent) => void) | null = null;

  try {
    const code = await new Promise<string>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new OAuthError('timeout', 'Sign-in timed out. Please try again.'));
      }, POPUP_TIMEOUT_MS);

      // Detect when the user manually closes the popup without completing auth.
      closedPollId = setInterval(() => {
        try {
          if (popup.closed) {
            reject(new OAuthError('cancelled', 'Sign-in was cancelled.'));
          }
        } catch {
          // Cross-origin frame guard — ignore and continue polling.
        }
      }, POPUP_CLOSED_POLL_MS);

      messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const data = event.data as {
          type?: string;
          code?: string;
          state?: string;
          error?: string;
        };
        if (data?.type !== 'archcanvas:auth-callback') return;

        if (data.error) {
          reject(new OAuthError('server_error', `OAuth error: ${data.error}`));
          return;
        }
        if (data.state !== state) {
          reject(new OAuthError('state_mismatch', 'OAuth state mismatch. Please try again.'));
          return;
        }
        if (!data.code) {
          reject(new OAuthError('server_error', 'No authorization code received.'));
          return;
        }
        resolve(data.code);
      };

      window.addEventListener('message', messageHandler);
    });

    return { code, verifier };
  } finally {
    // Always clean up — on success, failure, timeout, cancellation, or error.
    if (timeoutId !== null) clearTimeout(timeoutId);
    if (closedPollId !== null) clearInterval(closedPollId);
    if (messageHandler !== null) window.removeEventListener('message', messageHandler);
    try { if (!popup.closed) popup.close(); } catch { /* ignore */ }
  }
}

/** Exchange an authorization code for tokens using PKCE. */
export async function exchangeCodeForToken(
  keycloakUrl: string,
  realm: string,
  clientId: string,
  code: string,
  verifier: string,
): Promise<{ accessToken: string; idToken: string }> {
  const redirectUri = `${window.location.origin}/oauth-callback.html`;
  const res = await fetch(
    `${keycloakUrl}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error_description?: string };
    throw new OAuthError(
      'server_error',
      body.error_description ?? `Token exchange failed (${res.status})`,
    );
  }
  const data = await res.json() as { access_token: string; id_token: string };
  return { accessToken: data.access_token, idToken: data.id_token };
}

/** Sentinel returned when username cannot be extracted from the JWT. */
export const UNKNOWN_USERNAME = 'unknown';

/** Decode `preferred_username` (GitHub login) from a Keycloak ID token (JWT). */
export function extractUsername(idToken: string): string {
  try {
    // JWTs use base64url encoding; convert to standard base64 before decoding.
    const base64 = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as {
      preferred_username?: string;
      sub?: string;
    };
    return payload.preferred_username ?? payload.sub ?? UNKNOWN_USERNAME;
  } catch {
    return UNKNOWN_USERNAME;
  }
}
