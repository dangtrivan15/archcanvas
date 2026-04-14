import type Database from 'better-sqlite3';
import type { IUserRepository, UserRecord } from './types';

interface UserRow {
  id: number;
  github_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface NamespaceRow {
  name: string;
  owner_id: number | null;
  reserved: number;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    githubId: row.github_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository implements IUserRepository {
  constructor(private db: Database.Database) {}

  upsertFromGitHub(
    githubId: number,
    username: string,
    displayName: string | null,
    avatarUrl: string | null,
  ): UserRecord {
    const row = this.db
      .prepare(
        `INSERT INTO users (github_id, username, display_name, avatar_url)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(github_id) DO UPDATE SET
          username = excluded.username,
          display_name = excluded.display_name,
          avatar_url = excluded.avatar_url,
          updated_at = datetime('now')
        RETURNING *`,
      )
      .get(githubId, username, displayName, avatarUrl) as UserRow;

    return toUserRecord(row);
  }

  findById(id: number): UserRecord | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;

    return row ? toUserRecord(row) : null;
  }

  findByGitHubId(githubId: number): UserRecord | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE github_id = ?')
      .get(githubId) as UserRow | undefined;

    return row ? toUserRecord(row) : null;
  }

  checkNamespaceAccess(
    namespace: string,
    userId: number,
  ): { allowed: boolean; reason?: string } {
    const ns = this.db
      .prepare('SELECT * FROM namespaces WHERE name = ?')
      .get(namespace) as NamespaceRow | undefined;

    // Unclaimed namespace — allow (will be created on publish)
    if (!ns) return { allowed: true };

    // Reserved namespace — deny
    if (ns.reserved === 1) return { allowed: false, reason: 'reserved' };

    // Owner can publish
    if (ns.owner_id === userId) return { allowed: true };

    // Check collaborators
    const collab = this.db
      .prepare(
        'SELECT 1 FROM namespace_collaborators WHERE namespace = ? AND user_id = ?',
      )
      .get(namespace, userId);

    if (collab) return { allowed: true };

    return { allowed: false, reason: 'not_owner' };
  }

  createNamespace(name: string, ownerId: number): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO namespaces (name, owner_id, reserved) VALUES (?, ?, 0)`,
      )
      .run(name, ownerId);
  }
}
