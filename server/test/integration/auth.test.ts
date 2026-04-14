import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestApp, type TestContext } from '../helpers/testApp';
import { createTestUser, createTestJWT, authHeader } from '../helpers/testAuth';
import { AuthService } from '../../src/services/authService';
import { UserRepository } from '../../src/repositories/userRepository';

describe('Auth endpoints', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  describe('POST /api/v1/auth/github', () => {
    it('exchanges a GitHub code for JWT (mocked)', async () => {
      // Create a new auth service with mocked fetch
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          json: async () => ({ access_token: 'gh-token-123' }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: 99999,
            login: 'ghuser',
            name: 'GitHub User',
            avatar_url: 'https://avatars.test/ghuser.png',
          }),
        });

      const userRepo = new UserRepository(ctx.db);
      const authService = new AuthService(
        userRepo,
        ctx.authService['config'],
        mockFetch as unknown as typeof globalThis.fetch,
      );

      // Inject the mocked service into a new app
      const { createApp } = await import('../../src/app');
      const app = createApp({
        nodeDefService: ctx.nodeDefService,
        authService,
        metricsService: ctx.metricsService,
        userRepo,
        config: ctx.authService['config'],
      });

      const res = await app.request('/api/v1/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test-code' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.user.username).toBe('ghuser');
      expect(body.user.displayName).toBe('GitHub User');

      // Verify JWT is valid
      const verified = await authService.verifyToken(body.token);
      expect(verified?.username).toBe('ghuser');
    });
  });

  describe('POST /api/v1/auth/tokens', () => {
    it('creates an API token', async () => {
      const user = createTestUser(ctx.db, {
        username: 'tokenmaker',
        githubId: 4001,
      });
      const jwt = createTestJWT(ctx.authService, user.id, user.username);

      const res = await ctx.app.request('/api/v1/auth/tokens', {
        method: 'POST',
        headers: {
          ...authHeader(jwt),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'my-ci-token' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.name).toBe('my-ci-token');
      expect(body.token.length).toBe(64);
    });

    it('requires authentication', async () => {
      const res = await ctx.app.request('/api/v1/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'my-token' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns current user info', async () => {
      const user = createTestUser(ctx.db, {
        username: 'meuser',
        githubId: 4002,
      });
      const jwt = createTestJWT(ctx.authService, user.id, user.username);

      const res = await ctx.app.request('/api/v1/auth/me', {
        headers: authHeader(jwt),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.username).toBe('meuser');
      expect(body.id).toBe(user.id);
    });

    it('returns 401 without auth', async () => {
      const res = await ctx.app.request('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with malformed token', async () => {
      const res = await ctx.app.request('/api/v1/auth/me', {
        headers: { Authorization: 'Bearer malformed.token.here' },
      });
      expect(res.status).toBe(401);
    });
  });
});
