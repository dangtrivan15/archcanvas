import type { MiddlewareHandler } from 'hono';
import type { AuthService } from '../services/authService';
import { AuthenticationError } from './errorHandler';
import type { AppEnv } from '../types';

export function requireAuth(authService: AuthService): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const user = await authService.verifyToken(token);

    if (!user) {
      throw new AuthenticationError('Invalid or expired token');
    }

    c.set('user', user);
    await next();
  };
}
