import type Database from 'better-sqlite3';
import type { AuthService } from '../../src/services/authService';

interface TestUser {
  id: number;
  githubId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function createTestUser(
  db: Database.Database,
  overrides?: Partial<{
    githubId: number;
    username: string;
    displayName: string;
    avatarUrl: string;
  }>,
): TestUser {
  const githubId = overrides?.githubId ?? Math.floor(Math.random() * 1000000);
  const username = overrides?.username ?? `testuser-${githubId}`;
  const displayName = overrides?.displayName ?? 'Test User';
  const avatarUrl = overrides?.avatarUrl ?? 'https://avatars.test/user.png';

  const row = db
    .prepare(
      `INSERT INTO users (github_id, username, display_name, avatar_url)
      VALUES (?, ?, ?, ?)
      RETURNING *`,
    )
    .get(githubId, username, displayName, avatarUrl) as {
    id: number;
    github_id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };

  return {
    id: row.id,
    githubId: row.github_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

export function createTestJWT(
  authService: AuthService,
  userId: number,
  username: string,
): string {
  return authService.createJWT(userId, username);
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
