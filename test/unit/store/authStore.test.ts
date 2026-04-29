import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';

// Mock oauthFlow module
vi.mock('@/core/auth/oauthFlow', () => ({
  startOAuthPKCE: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  extractUsername: vi.fn(),
  OAuthError: class OAuthError extends Error {
    constructor(public kind: string, message: string) {
      super(message);
      this.name = 'OAuthError';
    }
  },
}));

import {
  startOAuthPKCE,
  exchangeCodeForToken,
  extractUsername,
  OAuthError,
} from '@/core/auth/oauthFlow';

const TOKEN_KEY = 'archcanvas:gh:token';
const USERNAME_KEY = 'archcanvas:gh:username';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      token: null,
      username: null,
      isAuthenticated: false,
      isSigningIn: false,
      error: null,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.username).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isSigningIn).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('_hydrate()', () => {
    it('restores token and username from localStorage', () => {
      localStorage.setItem(TOKEN_KEY, 'my-token');
      localStorage.setItem(USERNAME_KEY, 'alice');
      useAuthStore.getState()._hydrate();
      const state = useAuthStore.getState();
      expect(state.token).toBe('my-token');
      expect(state.username).toBe('alice');
      expect(state.isAuthenticated).toBe(true);
    });

    it('does not change state when localStorage is empty', () => {
      useAuthStore.getState()._hydrate();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.username).toBeNull();
    });

    it('does not throw when localStorage.getItem throws', () => {
      const original = localStorage.getItem;
      localStorage.getItem = () => { throw new Error('no storage'); };
      expect(() => useAuthStore.getState()._hydrate()).not.toThrow();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      localStorage.getItem = original;
    });
  });

  describe('signOut()', () => {
    it('clears token, username, and isAuthenticated', () => {
      useAuthStore.setState({ token: 't', username: 'u', isAuthenticated: true });
      localStorage.setItem(TOKEN_KEY, 't');
      localStorage.setItem(USERNAME_KEY, 'u');
      useAuthStore.getState().signOut();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.username).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USERNAME_KEY)).toBeNull();
    });
  });

  describe('clearToken()', () => {
    it('sets isAuthenticated to false, token and username to null', () => {
      useAuthStore.setState({ token: 't', username: 'u', isAuthenticated: true });
      localStorage.setItem(TOKEN_KEY, 't');
      localStorage.setItem(USERNAME_KEY, 'u');
      useAuthStore.getState().clearToken();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.username).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });

  describe('startSignIn()', () => {
    it('sets isSigningIn: true before awaiting', async () => {
      vi.stubEnv('VITE_KEYCLOAK_URL', 'https://auth.example.com');
      vi.stubEnv('VITE_KEYCLOAK_REALM', 'test');
      vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', 'client');

      // Never resolves — so we can check state mid-flight
      vi.mocked(startOAuthPKCE).mockReturnValue(new Promise(() => {}));

      const promise = useAuthStore.getState().startSignIn();
      expect(useAuthStore.getState().isSigningIn).toBe(true);
      // Clean up the hanging promise by not awaiting it
      void promise;
    });

    it('sets error on OAuthError and clears isSigningIn', async () => {
      vi.stubEnv('VITE_KEYCLOAK_URL', 'https://auth.example.com');
      vi.stubEnv('VITE_KEYCLOAK_REALM', 'test');
      vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', 'client');

      vi.mocked(startOAuthPKCE).mockRejectedValue(
        new OAuthError('cancelled', 'Sign-in was cancelled.')
      );

      await useAuthStore.getState().startSignIn();
      const state = useAuthStore.getState();
      expect(state.error).toBe('Sign-in was cancelled.');
      expect(state.isSigningIn).toBe(false);
    });

    it('sets "not configured" error when env vars are absent', async () => {
      vi.stubEnv('VITE_KEYCLOAK_URL', '');
      vi.stubEnv('VITE_KEYCLOAK_REALM', '');
      vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', '');

      await useAuthStore.getState().startSignIn();
      const state = useAuthStore.getState();
      expect(state.error).toContain('not configured');
      expect(state.isSigningIn).toBe(false);
    });

    it('sets isAuthenticated and stores token on success', async () => {
      vi.stubEnv('VITE_KEYCLOAK_URL', 'https://auth.example.com');
      vi.stubEnv('VITE_KEYCLOAK_REALM', 'test');
      vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', 'client');

      vi.mocked(startOAuthPKCE).mockResolvedValue({ code: 'code123', verifier: 'ver123' });
      vi.mocked(exchangeCodeForToken).mockResolvedValue({
        accessToken: 'access-token',
        idToken: 'id-token',
      });
      vi.mocked(extractUsername).mockReturnValue('alice');

      await useAuthStore.getState().startSignIn();
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('access-token');
      expect(state.username).toBe('alice');
      expect(state.isSigningIn).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBe('access-token');
      expect(localStorage.getItem(USERNAME_KEY)).toBe('alice');
    });
  });
});
