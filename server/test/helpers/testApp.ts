import Database from 'better-sqlite3';
import { runMigrations } from '../../src/db/migrate';
import { createApp } from '../../src/app';
import { NodeDefRepository } from '../../src/repositories/nodeDefRepository';
import { UserRepository } from '../../src/repositories/userRepository';
import { MetricsRepository } from '../../src/repositories/metricsRepository';
import { AuthService } from '../../src/services/authService';
import { MetricsService } from '../../src/services/metricsService';
import { NodeDefService } from '../../src/services/nodeDefService';
import type { Config } from '../../src/config';
import type { Hono } from 'hono';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEST_CONFIG: Config = {
  databasePath: ':memory:',
  port: 3001,
  host: '0.0.0.0',
  jwtSecret: 'test-secret-key-for-testing-only',
  githubClientId: 'test-client-id',
  githubClientSecret: 'test-client-secret',
  corsOrigin: ['http://localhost:5173'],
  logLevel: 'error',
  nodeEnv: 'test',
};

export interface TestContext {
  app: Hono;
  db: Database.Database;
  nodeDefRepo: NodeDefRepository;
  userRepo: UserRepository;
  metricsRepo: MetricsRepository;
  authService: AuthService;
  metricsService: MetricsService;
  nodeDefService: NodeDefService;
}

export function createTestApp(
  configOverrides?: Partial<Config>,
  nowFn?: () => number,
): TestContext {
  const config = { ...TEST_CONFIG, ...configOverrides };

  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrationsDir = path.resolve(
    __dirname,
    '../../src/db/migrations',
  );
  runMigrations(db, migrationsDir);

  const nodeDefRepo = new NodeDefRepository(db);
  const userRepo = new UserRepository(db);
  const metricsRepo = new MetricsRepository(db);

  const authService = new AuthService(userRepo, config);
  const metricsService = new MetricsService(metricsRepo, nowFn);
  const nodeDefService = new NodeDefService(
    nodeDefRepo,
    userRepo,
    metricsService,
  );

  const app = createApp({
    nodeDefService,
    authService,
    metricsService,
    userRepo,
    config,
  });

  return {
    app,
    db,
    nodeDefRepo,
    userRepo,
    metricsRepo,
    authService,
    metricsService,
    nodeDefService,
  };
}
