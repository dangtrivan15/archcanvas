import type Database from 'better-sqlite3';
import type { IApiTokenRepository, ApiTokenRecord } from './types';

interface ApiTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  prefix: string;
}

export class ApiTokenRepository implements IApiTokenRepository {
  constructor(private db: Database.Database) {}

  findByPrefix(prefix: string): ApiTokenRecord[] {
    const rows = this.db
      .prepare('SELECT id, user_id, token_hash, prefix FROM api_tokens WHERE prefix = ?')
      .all(prefix) as ApiTokenRow[];

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      prefix: row.prefix,
    }));
  }

  create(userId: number, name: string, tokenHash: string, prefix: string): void {
    this.db
      .prepare(
        'INSERT INTO api_tokens (user_id, name, token_hash, prefix) VALUES (?, ?, ?, ?)',
      )
      .run(userId, name, tokenHash, prefix);
  }

  updateLastUsed(tokenId: number): void {
    this.db
      .prepare("UPDATE api_tokens SET last_used = datetime('now') WHERE id = ?")
      .run(tokenId);
  }

  deleteByIdAndUser(tokenId: number, userId: number): boolean {
    const result = this.db
      .prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?')
      .run(tokenId, userId);

    return result.changes > 0;
  }
}
