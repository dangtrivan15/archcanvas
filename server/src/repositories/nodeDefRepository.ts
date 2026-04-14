import type Database from 'better-sqlite3';
import type { NodeDef } from '@/types/nodeDefSchema';
import type {
  INodeDefRepository,
  SearchFilters,
  Pagination,
  SearchResult,
  SearchResultItem,
  NodeDefRecord,
} from './types';
import { ValidationError } from '../middleware/errorHandler';

interface NodeDefRow {
  id: number;
  namespace: string;
  name: string;
  latest_version: string;
  display_name: string;
  description: string;
  icon: string;
  tags: string;
  shape: string;
  publisher_id: number;
  total_downloads: number;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: number;
  nodedef_id: number;
  version: string;
  yaml_blob: string;
  metadata: string;
  spec: string;
  downloads: number;
  published_by: number;
  created_at: string;
}

interface UserRow {
  username: string;
  avatar_url: string | null;
}

export class NodeDefRepository implements INodeDefRepository {
  constructor(private db: Database.Database) {}

  search(
    query: string | null,
    filters: SearchFilters,
    pagination: Pagination,
  ): SearchResult {
    const { page, pageSize, sort } = pagination;
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];

    let fromClause: string;
    let whereConditions: string[] = [];
    let orderBy: string;

    if (query) {
      fromClause = `
        FROM fts_nodedefs fts
        JOIN nodedefs n ON n.id = fts.rowid
        JOIN users u ON u.id = n.publisher_id
      `;
      whereConditions.push('fts_nodedefs MATCH ?');
      params.push(query);
    } else {
      fromClause = `
        FROM nodedefs n
        JOIN users u ON u.id = n.publisher_id
      `;
    }

    if (filters.namespace) {
      whereConditions.push('n.namespace = ?');
      params.push(filters.namespace);
    }

    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        whereConditions.push("EXISTS (SELECT 1 FROM json_each(n.tags) WHERE json_each.value = ?)");
        params.push(tag);
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

    // Count total
    const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
    let totalRow: { total: number };
    try {
      totalRow = this.db.prepare(countSql).get(...params) as {
        total: number;
      };
    } catch (err) {
      // FTS5 syntax errors (e.g. unbalanced quotes, invalid operators) come through here.
      // When we have a query, SQLite errors are most likely FTS5 syntax issues from user input.
      if (query && err instanceof Error && (err as { code?: string }).code === 'SQLITE_ERROR') {
        throw new ValidationError(`Invalid search query: ${err.message}`);
      }
      throw err;
    }
    const total = totalRow.total;

    // Determine sort order
    if (query && sort === 'relevance') {
      orderBy = 'ORDER BY bm25(fts_nodedefs)';
    } else {
      switch (sort) {
        case 'recent':
          orderBy = 'ORDER BY n.updated_at DESC';
          break;
        case 'popular':
          orderBy = 'ORDER BY n.total_downloads DESC';
          break;
        case 'name':
          orderBy = 'ORDER BY n.name ASC';
          break;
        default:
          orderBy = 'ORDER BY n.updated_at DESC';
          break;
      }
    }

    const selectSql = `
      SELECT
        n.namespace, n.name, n.latest_version as version,
        n.display_name, n.description, n.icon, n.tags, n.shape,
        n.total_downloads as downloads,
        n.created_at, n.updated_at,
        u.username as publisher_username,
        u.avatar_url as publisher_avatar_url
      ${fromClause}
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    let rows: Array<
      NodeDefRow & {
        version: string;
        downloads: number;
        publisher_username: string;
        publisher_avatar_url: string | null;
      }
    >;
    try {
      rows = this.db
        .prepare(selectSql)
        .all(...params, pageSize, offset) as typeof rows;
    } catch (err) {
      if (query && err instanceof Error && (err as { code?: string }).code === 'SQLITE_ERROR') {
        throw new ValidationError(`Invalid search query: ${err.message}`);
      }
      throw err;
    }

    const items: SearchResultItem[] = rows.map((row) => ({
      namespace: row.namespace,
      name: row.name,
      version: row.version,
      displayName: row.display_name,
      description: row.description,
      icon: row.icon,
      tags: JSON.parse(row.tags) as string[],
      shape: row.shape,
      publisher: {
        username: row.publisher_username,
        avatarUrl: row.publisher_avatar_url,
      },
      downloads: row.downloads,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { items, total };
  }

  findByKey(
    namespace: string,
    name: string,
    version?: string,
  ): NodeDefRecord | null {
    const nodedef = this.db
      .prepare('SELECT * FROM nodedefs WHERE namespace = ? AND name = ?')
      .get(namespace, name) as NodeDefRow | undefined;

    if (!nodedef) return null;

    let versionRow: VersionRow | undefined;
    if (version) {
      versionRow = this.db
        .prepare(
          'SELECT * FROM nodedef_versions WHERE nodedef_id = ? AND version = ?',
        )
        .get(nodedef.id, version) as VersionRow | undefined;
    } else {
      versionRow = this.db
        .prepare(
          'SELECT * FROM nodedef_versions WHERE nodedef_id = ? AND version = ?',
        )
        .get(nodedef.id, nodedef.latest_version) as VersionRow | undefined;
    }

    if (!versionRow) return null;

    const publisher = this.db
      .prepare('SELECT username, avatar_url FROM users WHERE id = ?')
      .get(nodedef.publisher_id) as UserRow;

    const versions = this.listVersions(namespace, name);

    // Build the full NodeDef object from stored metadata + spec
    const metadata = JSON.parse(versionRow.metadata);
    const spec = JSON.parse(versionRow.spec);
    const nodeDef = {
      kind: 'NodeDef',
      apiVersion: 'v1',
      metadata,
      spec,
    };

    return {
      id: nodedef.id,
      nodeDef,
      yamlBlob: versionRow.yaml_blob,
      publisher: {
        username: publisher.username,
        avatarUrl: publisher.avatar_url,
      },
      versions,
      downloads: {
        total: nodedef.total_downloads,
        thisVersion: versionRow.downloads,
      },
      createdAt: nodedef.created_at,
      updatedAt: nodedef.updated_at,
    };
  }

  publish(
    nodeDef: NodeDef,
    yamlBlob: string,
    userId: number,
  ): { id: number } {
    const { metadata, spec, variants } = nodeDef;
    const tagsJson = JSON.stringify(metadata.tags || []);
    const shapeStr =
      typeof metadata.shape === 'string'
        ? metadata.shape
        : JSON.stringify(metadata.shape);

    const result = this.db.transaction(() => {
      // Check if nodedefs row exists
      const existing = this.db
        .prepare(
          'SELECT id FROM nodedefs WHERE namespace = ? AND name = ?',
        )
        .get(metadata.namespace, metadata.name) as
        | { id: number }
        | undefined;

      let nodedefId: number;

      if (existing) {
        // Update existing entry
        this.db
          .prepare(
            `UPDATE nodedefs SET
              latest_version = ?, display_name = ?, description = ?,
              icon = ?, tags = ?, shape = ?, updated_at = datetime('now')
            WHERE id = ?`,
          )
          .run(
            metadata.version,
            metadata.displayName,
            metadata.description,
            metadata.icon,
            tagsJson,
            shapeStr,
            existing.id,
          );
        nodedefId = existing.id;
      } else {
        // Insert new entry
        const insertResult = this.db
          .prepare(
            `INSERT INTO nodedefs
              (namespace, name, latest_version, display_name, description, icon, tags, shape, publisher_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            metadata.namespace,
            metadata.name,
            metadata.version,
            metadata.displayName,
            metadata.description,
            metadata.icon,
            tagsJson,
            shapeStr,
            userId,
          );
        nodedefId = insertResult.lastInsertRowid as number;
      }

      // Insert version
      this.db
        .prepare(
          `INSERT INTO nodedef_versions
            (nodedef_id, version, yaml_blob, metadata, spec, published_by)
          VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          nodedefId,
          metadata.version,
          yamlBlob,
          JSON.stringify(metadata),
          JSON.stringify({ spec, variants }),
          userId,
        );

      // FTS5 sync: delete old entry if updating, then insert
      if (existing) {
        this.db
          .prepare('DELETE FROM fts_nodedefs WHERE rowid = ?')
          .run(nodedefId);
      }
      this.db
        .prepare(
          `INSERT INTO fts_nodedefs(rowid, namespace, name, display_name, description, tags)
          VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          nodedefId,
          metadata.namespace,
          metadata.name,
          metadata.displayName,
          metadata.description,
          (metadata.tags || []).join(' '),
        );

      return { id: nodedefId };
    })();

    return result;
  }

  listVersions(namespace: string, name: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT v.version FROM nodedef_versions v
        JOIN nodedefs n ON n.id = v.nodedef_id
        WHERE n.namespace = ? AND n.name = ?
        ORDER BY v.created_at DESC`,
      )
      .all(namespace, name) as Array<{ version: string }>;

    return rows.map((r) => r.version);
  }

  exists(namespace: string, name: string, version: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM nodedef_versions v
        JOIN nodedefs n ON n.id = v.nodedef_id
        WHERE n.namespace = ? AND n.name = ? AND v.version = ?`,
      )
      .get(namespace, name, version);

    return !!row;
  }
}
