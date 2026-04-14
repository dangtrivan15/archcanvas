import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../../src/db/migrate';
import { UserRepository } from '../../../src/repositories/userRepository';
import { ApiTokenRepository } from '../../../src/repositories/apiTokenRepository';
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
  let apiTokenRepo: ApiTokenRepository;
  let authService: AuthService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(
      db,
      path.resolve(__dirname, '../../../src/db/migrations'),
    );
    userRepo = new UserRepository(db);
    apiTokenRepo = new ApiTokenRepository(db);
    authService = new AuthService(userRepo, apiTokenRepo, TEST_CONFIG);
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
      const otherAuth = new AuthService(userRepo, apiTokenRepo, otherConfig);
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

    it('revokes an API token', async () => {
      userRepo.upsertFromGitHub(12345, 'tokenuser', 'Token User', null);
      const user = userRepo.findByGitHubId(12345)!;

      const { token } = await authService.createAPIToken(user.id, 'revoke-me');

      // Verify token works before revocation
      const beforeRevoke = await authService.verifyToken(token);
      expect(beforeRevoke).not.toBeNull();

      // Get token ID from DB
      const tokenRow = db
        .prepare('SELECT id FROM api_tokens WHERE user_id = ?')
        .get(user.id) as { id: number };

      // Revoke it
      const revoked = await authService.revokeAPIToken(tokenRow.id, user.id);
      expect(revoked).toBe(true);

      // Verify token no longer works
      const afterRevoke = await authService.verifyToken(token);
      expect(afterRevoke).toBeNull();
    });

    it('revokeAPIToken returns false for non-existent token', async () => {
      userRepo.upsertFromGitHub(12345, 'tokenuser', 'Token User', null);
      const user = userRepo.findByGitHubId(12345)!;

      const revoked = await authService.revokeAPIToken(999, user.id);
      expect(revoked).toBe(false);
    });

    it('revokeAPIToken returns false for wrong user', async () => {
      userRepo.upsertFromGitHub(12345, 'tokenuser', 'Token User', null);
      const user = userRepo.findByGitHubId(12345)!;
      userRepo.upsertFromGitHub(12346, 'otheruser', 'Other User', null);
      const otherUser = userRepo.findByGitHubId(12346)!;

      await authService.createAPIToken(user.id, 'my-token');
      const tokenRow = db
        .prepare('SELECT id FROM api_tokens WHERE user_id = ?')
        .get(user.id) as { id: number };

      // Try to revoke as another user
      const revoked = await authService.revokeAPIToken(tokenRow.id, otherUser.id);
      expect(revoked).toBe(false);
    });
  });
});
