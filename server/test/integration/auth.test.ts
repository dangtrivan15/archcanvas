import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestApp, type TestContext } from '../helpers/testApp';
import { createTestUser, createTestJWT, authHeader } from '../helpers/testAuth';
import { AuthService } from '../../src/services/authService';
import { UserRepository } from '../../src/repositories/userRepository';
import { ApiTokenRepository } from '../../src/repositories/apiTokenRepository';

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
          ok: true,
          json: async () => ({ access_token: 'gh-token-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 99999,
            login: 'ghuser',
            name: 'GitHub User',
            avatar_url: 'https://avatars.test/ghuser.png',
          }),
        });

      const userRepo = new UserRepository(ctx.db);
      const apiTokenRepo = new ApiTokenRepository(ctx.db);
      const authService = new AuthService(
        userRepo,
        apiTokenRepo,
        ctx.authService['config'],
        mockFetch as unknown as typeof globalThis.fetch,
      );

      // Inject the mocked service into a new app
      const { createApp } = await import('../../src/app');
      const app = createApp({
        nodeDefService: ctx.nodeDefService,
        authService,
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

    it('returns 400 for malformed JSON body', async () => {
      const res = await ctx.app.request('/api/v1/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns error when GitHub token exchange fails', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({}),
        });

      const userRepo = new UserRepository(ctx.db);
      const apiTokenRepo = new ApiTokenRepository(ctx.db);
      const authService = new AuthService(
        userRepo,
        apiTokenRepo,
        ctx.authService['config'],
        mockFetch as unknown as typeof globalThis.fetch,
      );

      const { createApp } = await import('../../src/app');
      const app = createApp({
        nodeDefService: ctx.nodeDefService,
        authService,
        userRepo,
        config: ctx.authService['config'],
      });

      const res = await app.request('/api/v1/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'bad-code' }),
      });

      expect(res.status).toBe(500);
    });

    it('returns error when GitHub user API fails', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'gh-token-123' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Bad credentials' }),
        });

      const userRepo = new UserRepository(ctx.db);
      const apiTokenRepo = new ApiTokenRepository(ctx.db);
      const authService = new AuthService(
        userRepo,
        apiTokenRepo,
        ctx.authService['config'],
        mockFetch as unknown as typeof globalThis.fetch,
      );

      const { createApp } = await import('../../src/app');
      const app = createApp({
        nodeDefService: ctx.nodeDefService,
        authService,
        userRepo,
        config: ctx.authService['config'],
      });

      const res = await app.request('/api/v1/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test-code' }),
      });

      expect(res.status).toBe(500);
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

    it('returns 400 for malformed JSON body', async () => {
      const user = createTestUser(ctx.db, {
        username: 'tokenmaker2',
        githubId: 4003,
      });
      const jwt = createTestJWT(ctx.authService, user.id, user.username);

      const res = await ctx.app.request('/api/v1/auth/tokens', {
        method: 'POST',
        headers: {
          ...authHeader(jwt),
          'Content-Type': 'application/json',
        },
        body: 'not json',
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('DELETE /api/v1/auth/tokens/:id', () => {
    it('revokes an existing API token', async () => {
      const user = createTestUser(ctx.db, {
        username: 'revoker',
        githubId: 4010,
      });
      const jwt = createTestJWT(ctx.authService, user.id, user.username);

      // Create a token first
      const createRes = await ctx.app.request('/api/v1/auth/tokens', {
        method: 'POST',
        headers: {
          ...authHeader(jwt),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'to-revoke' }),
      });
      expect(createRes.status).toBe(201);

      // Get the token ID from the DB
      const tokenRow = ctx.db
        .prepare('SELECT id FROM api_tokens WHERE user_id = ? AND name = ?')
        .get(user.id, 'to-revoke') as { id: number };

      // Revoke it
      const res = await ctx.app.request(
        `/api/v1/auth/tokens/${tokenRow.id}`,
        {
          method: 'DELETE',
          headers: authHeader(jwt),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Token revoked successfully');
    });

    it('returns 404 for non-existent token', async () => {
      const user = createTestUser(ctx.db, {
        username: 'revoker2',
        githubId: 4011,
      });
      const jwt = createTestJWT(ctx.authService, user.id, user.username);

      const res = await ctx.app.request('/api/v1/auth/tokens/999', {
        method: 'DELETE',
        headers: authHeader(jwt),
      });

      expect(res.status).toBe(404);
    });

    it('returns 404 when trying to revoke another user token', async () => {
      const user1 = createTestUser(ctx.db, {
        username: 'owner1',
        githubId: 4012,
      });
      const user2 = createTestUser(ctx.db, {
        username: 'attacker',
        githubId: 4013,
      });
      const jwt1 = createTestJWT(ctx.authService, user1.id, user1.username);
      const jwt2 = createTestJWT(ctx.authService, user2.id, user2.username);

      // User 1 creates a token
      await ctx.app.request('/api/v1/auth/tokens', {
        method: 'POST',
        headers: {
          ...authHeader(jwt1),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'private-token' }),
      });

      const tokenRow = ctx.db
        .prepare('SELECT id FROM api_tokens WHERE user_id = ?')
        .get(user1.id) as { id: number };

      // User 2 tries to revoke
      const res = await ctx.app.request(
        `/api/v1/auth/tokens/${tokenRow.id}`,
        {
          method: 'DELETE',
          headers: authHeader(jwt2),
        },
      );

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await ctx.app.request('/api/v1/auth/tokens/1', {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid token ID', async () => {
      const user = createTestUser(ctx.db, {
        username: 'badreq',
        githubId: 4014,
      });
      const jwt = createTestJWT(ctx.authService, user.id, user.username);

      const res = await ctx.app.request('/api/v1/auth/tokens/notanumber', {
        method: 'DELETE',
        headers: authHeader(jwt),
      });

      expect(res.status).toBe(400);
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
