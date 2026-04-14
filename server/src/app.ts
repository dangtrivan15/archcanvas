import { Hono } from 'hono';
import { createNodeDefRoutes } from './routes/nodeDefs';
import { createAuthRoutes } from './routes/auth';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import type { NodeDefService } from './services/nodeDefService';
import type { AuthService } from './services/authService';
import type { IUserRepository } from './repositories/types';
import type { Config } from './config';

export interface AppDependencies {
  nodeDefService: NodeDefService;
  authService: AuthService;
  userRepo: IUserRepository;
  config: Config;
}

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.onError(errorHandler);
  app.use('*', corsMiddleware(deps.config));

  app.route('/', createNodeDefRoutes(deps));
  app.route('/', createAuthRoutes(deps));

  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
}
