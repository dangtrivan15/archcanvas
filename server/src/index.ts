import { serve } from '@hono/node-server';
import { loadConfig } from './config';
import { createDatabase } from './db/connection';
import { runMigrations } from './db/migrate';
import { createApp } from './app';
import { NodeDefRepository } from './repositories/nodeDefRepository';
import { UserRepository } from './repositories/userRepository';
import { MetricsRepository } from './repositories/metricsRepository';
import { AuthService } from './services/authService';
import { MetricsService } from './services/metricsService';
import { NodeDefService } from './services/nodeDefService';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const config = loadConfig();

// Ensure data directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = createDatabase(config.databasePath);

// Resolve migrations directory — works for dev (src/), prod Docker (../migrations), and local prod (../src/db/migrations)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationCandidates = [
  path.join(__dirname, 'db', 'migrations'),        // dev mode (tsx src/index.ts)
  path.join(__dirname, '..', 'migrations'),         // Docker production
  path.join(__dirname, '..', 'src', 'db', 'migrations'), // local production (node dist/index.js)
];
const migrationsDir = migrationCandidates.find((d) => fs.existsSync(d)) || migrationCandidates[0];

runMigrations(db, migrationsDir);

// Create repositories
const nodeDefRepo = new NodeDefRepository(db);
const userRepo = new UserRepository(db);
const metricsRepo = new MetricsRepository(db);

// Create services
const authService = new AuthService(userRepo, config);
const metricsService = new MetricsService(metricsRepo);
const nodeDefService = new NodeDefService(nodeDefRepo, userRepo, metricsService);

metricsService.startCleanup();

const app = createApp({
  nodeDefService,
  authService,
  metricsService,
  userRepo,
  config,
});

serve(
  { fetch: app.fetch, port: config.port, hostname: config.host },
  (info) => {
    console.log(
      `Registry server listening on http://${config.host}:${info.port}`,
    );
    console.log(`Database: ${config.databasePath}`);
  },
);
