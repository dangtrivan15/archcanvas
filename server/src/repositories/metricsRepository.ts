import type Database from 'better-sqlite3';
import type { IMetricsRepository } from './types';

export class MetricsRepository implements IMetricsRepository {
  constructor(private db: Database.Database) {}

  incrementDownload(nodedefId: number, version: string, day: string): void {
    this.db
      .prepare(
        `INSERT INTO download_events (nodedef_id, version, day, count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(nodedef_id, version, day) DO UPDATE SET count = count + 1`,
      )
      .run(nodedefId, version, day);

    this.db
      .prepare('UPDATE nodedefs SET total_downloads = total_downloads + 1 WHERE id = ?')
      .run(nodedefId);

    this.db
      .prepare(
        'UPDATE nodedef_versions SET downloads = downloads + 1 WHERE nodedef_id = ? AND version = ?',
      )
      .run(nodedefId, version);
  }

  getDownloadStats(
    nodedefId: number,
  ): { total: number; byVersion: Record<string, number> } {
    const totalRow = this.db
      .prepare('SELECT total_downloads FROM nodedefs WHERE id = ?')
      .get(nodedefId) as { total_downloads: number } | undefined;

    const total = totalRow?.total_downloads ?? 0;

    const versionRows = this.db
      .prepare(
        'SELECT version, downloads FROM nodedef_versions WHERE nodedef_id = ?',
      )
      .all(nodedefId) as Array<{ version: string; downloads: number }>;

    const byVersion: Record<string, number> = {};
    for (const row of versionRows) {
      byVersion[row.version] = row.downloads;
    }

    return { total, byVersion };
  }

  getTrending(
    days: number,
    limit: number,
  ): Array<{ nodedefId: number; downloads: number }> {
    const rows = this.db
      .prepare(
        `SELECT nodedef_id, SUM(count) as dl
        FROM download_events
        WHERE day >= date('now', '-' || ? || ' days')
        GROUP BY nodedef_id
        ORDER BY dl DESC
        LIMIT ?`,
      )
      .all(days, limit) as Array<{ nodedef_id: number; dl: number }>;

    return rows.map((r) => ({
      nodedefId: r.nodedef_id,
      downloads: r.dl,
    }));
  }
}
