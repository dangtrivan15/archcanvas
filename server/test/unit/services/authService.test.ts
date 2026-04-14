import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../../src/db/migrate';
import { UserRepository } from '../../../src/repositories/userRepository';
import { AuthService } from '../../../src/services/authService';
import type { Config } from '../../../src/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_CONFIG: Config = {
  databasePath: ':memory:',
  port: 3001,
  host: '0.0.0.0',
  jwtSecret: 'test-secret-key',
  githubClientId: 'test-client-id',
  githubClientSecret: 'test-client-secret',
  corsOrigin: ['http://localhost:5173'],
  logLevel: 'error',
  nodeEnv: 'test',
};

describe('AuthService', () => {
  let db: Database.Database;
  let userRepo: UserRepository;
  let authService: AuthService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(
      db,
      path.resolve(__dirname, '../../../src/db/migrations'),
    );
    userRepo = new UserRepository(db);
    authService = new AuthService(userRepo, TEST_CONFIG);
  });

  describe('JWT', () => {
    it('creates and verifies a JWT', async () => {
      const token = authService.createJWT(1, 'testuser');
      const result = await authService.verifyToken(token);
      expect(result).toEqual({ userId: 1, username: 'testuser' });
    });

    it('rejects an invalid JWT', async () => {
      const result = await authService.verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('rejects a JWT signed with wrong secret', async () => {
      const otherConfig = { ...TEST_CONFIG, jwtSecret: 'other-secret' };
      const otherAuth = new AuthService(userRepo, otherConfig);
      const token = otherAuth.createJWT(1, 'testuser');

      const result = await authService.verifyToken(token);
      expect(result).toBeNull();
    });
  });

  describe('API tokens', () => {
    it('creates and verifies an API token', async () => {
      // Create a user first
      userRepo.upsertFromGitHub(12345, 'tokenuser', 'Token User', null);
      const user = userRepo.findByGitHubId(12345)!;

      const { token } = await authService.createAPIToken(
        user.id,
        'test-token',
      );
      expect(token).toHaveLength(64); // 32 bytes hex

      const result = await authService.verifyToken(token);
      expect(result).toEqual({
        userId: user.id,
        username: 'tokenuser',
      });
    });
  });
});
