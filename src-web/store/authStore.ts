import { create } from 'zustand';
import {
  startOAuthPKCE,
  exchangeCodeForToken,
  extractUsername,
  OAuthError,
} from '@/core/auth/oauthFlow';

const TOKEN_KEY = 'archcanvas:gh:token';
const USERNAME_KEY = 'archcanvas:gh:username';

// --- Safe localStorage helpers (match uiStore.ts convention) ---

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage unavailable (private mode, security policy)
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage full or unavailable — token is session-only
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// --- Store ---

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isSigningIn: boolean;
  error: string | null;
  startSignIn(): Promise<void>;
  signOut(): void;
  /** Called on 401 from registry — clears token and prompts re-sign-in. */
  clearToken(): void;
  /** Re-hydrate auth state from localStorage on app start. */
  _hydrate(): void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  username: null,
  isAuthenticated: false,
  isSigningIn: false,
  error: null,

  _hydrate() {
    const token = safeGetItem(TOKEN_KEY);
    const username = safeGetItem(USERNAME_KEY);
    if (token && username) {
      set({ token, username, isAuthenticated: true });
    }
  },

  async startSignIn() {
    const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
    const realm = import.meta.env.VITE_KEYCLOAK_REALM;
    const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;

    if (!keycloakUrl || !realm || !clientId) {
      set({ error: 'GitHub sign-in is not configured for this deployment.' });
      return;
    }

    set({ isSigningIn: true, error: null });
    try {
      const { code, verifier } = await startOAuthPKCE(keycloakUrl, realm, clientId);
      const { accessToken, idToken } = await exchangeCodeForToken(
        keycloakUrl,
        realm,
        clientId,
        code,
        verifier,
      );
      const username = extractUsername(idToken);
      safeSetItem(TOKEN_KEY, accessToken);
      safeSetItem(USERNAME_KEY, username);
      set({ token: accessToken, username, isAuthenticated: true, isSigningIn: false, error: null });
    } catch (err) {
      const message =
        err instanceof OAuthError ? err.message : 'Sign-in failed. Please try again.';
      set({ isSigningIn: false, error: message });
    }
  },

  signOut() {
    safeRemoveItem(TOKEN_KEY);
    safeRemoveItem(USERNAME_KEY);
    set({ token: null, username: null, isAuthenticated: false, error: null });
  },

  clearToken() {
    safeRemoveItem(TOKEN_KEY);
    safeRemoveItem(USERNAME_KEY);
    set({ token: null, username: null, isAuthenticated: false });
  },
}));
