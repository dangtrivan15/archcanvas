import { Hono } from 'hono';
import type { AuthService } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import {
  GitHubAuthSchema,
  CreateTokenSchema,
  validateRequest,
} from '../validation/querySchemas';
import { ValidationError } from '../middleware/errorHandler';
import type { IUserRepository } from '../repositories/types';
import type { AppEnv } from '../types';

interface AuthRoutesDeps {
  authService: AuthService;
  userRepo: IUserRepository;
}

export function createAuthRoutes(deps: AuthRoutesDeps): Hono<AppEnv> {
  const { authService, userRepo } = deps;
  const app = new Hono<AppEnv>();

  // POST /api/v1/auth/github — GitHub OAuth code exchange
  app.post('/api/v1/auth/github', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ValidationError('Request body must be valid JSON');
    }
    const parsed = validateRequest(GitHubAuthSchema, body);
    if ('error' in parsed) {
      throw new ValidationError(parsed.error);
    }

    const { token, user } = await authService.exchangeGitHubCode(
      parsed.data.code,
    );

    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  });

  // POST /api/v1/auth/tokens — Generate API token (authenticated)
  app.post(
    '/api/v1/auth/tokens',
    requireAuth(authService),
    async (c) => {
      const user = c.get('user');
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        throw new ValidationError('Request body must be valid JSON');
      }
      const parsed = validateRequest(CreateTokenSchema, body);
      if ('error' in parsed) {
        throw new ValidationError(parsed.error);
      }

      const result = await authService.createAPIToken(
        user.userId,
        parsed.data.name,
      );

      return c.json({
        token: result.token,
        name: result.name,
      }, 201);
    },
  );

  // DELETE /api/v1/auth/tokens/:id — Revoke API token (authenticated)
  app.delete(
    '/api/v1/auth/tokens/:id',
    requireAuth(authService),
    async (c) => {
      const user = c.get('user');
      const tokenId = parseInt(c.req.param('id'), 10);

      if (isNaN(tokenId) || tokenId <= 0) {
        throw new ValidationError('Invalid token ID');
      }

      const deleted = await authService.revokeAPIToken(tokenId, user.userId);

      if (!deleted) {
        return c.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Token not found or does not belong to you',
            },
          },
          404,
        );
      }

      return c.json({ message: 'Token revoked successfully' });
    },
  );

  // GET /api/v1/auth/me — Current user info (authenticated)
  app.get('/api/v1/auth/me', requireAuth(authService), (c) => {
    const authUser = c.get('user') as { userId: number; username: string };
    const user = userRepo.findById(authUser.userId);

    if (!user) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' } },
        404,
      );
    }

    return c.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    });
  });

  return app;
}
