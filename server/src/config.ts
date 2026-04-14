export interface Config {
  databasePath: string;
  port: number;
  host: string;
  jwtSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  corsOrigin: string[];
  logLevel: string;
  nodeEnv: string;
}

export function loadConfig(): Config {
  const env = process.env;
  return {
    databasePath: env.DATABASE_PATH || './data/registry.db',
    port: parseInt(env.PORT || '3001', 10),
    host: env.HOST || '0.0.0.0',
    jwtSecret:
      env.JWT_SECRET ||
      (env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('JWT_SECRET is required in production');
          })()
        : 'dev-secret-do-not-use-in-prod'),
    githubClientId: env.GITHUB_CLIENT_ID || '',
    githubClientSecret: env.GITHUB_CLIENT_SECRET || '',
    corsOrigin: (env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
    logLevel: env.LOG_LEVEL || 'info',
    nodeEnv: env.NODE_ENV || 'development',
  };
}
