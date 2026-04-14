import type { AuthUser } from './services/authService';

// Hono environment type for c.set/c.get
export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};
