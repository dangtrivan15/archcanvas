import { cors } from 'hono/cors';
import type { Config } from '../config';

export function corsMiddleware(config: Config) {
  return cors({
    origin: config.corsOrigin,
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });
}
