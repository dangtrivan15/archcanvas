-- Users (from GitHub OAuth)
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id     INTEGER UNIQUE NOT NULL,
    username      TEXT UNIQUE NOT NULL,
    display_name  TEXT,
    avatar_url    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API tokens for CI/CD
CREATE TABLE api_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    name        TEXT NOT NULL,
    token_hash  TEXT NOT NULL,
    prefix      TEXT NOT NULL DEFAULT '',
    last_used   TEXT,
    expires_at  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Namespace ownership
-- owner_id is NULLABLE: reserved namespaces have owner_id = NULL, reserved = 1.
CREATE TABLE namespaces (
    name        TEXT PRIMARY KEY,
    owner_id    INTEGER REFERENCES users(id),
    reserved    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Collaborators on namespaces
CREATE TABLE namespace_collaborators (
    namespace   TEXT NOT NULL REFERENCES namespaces(name),
    user_id     INTEGER NOT NULL REFERENCES users(id),
    role        TEXT NOT NULL DEFAULT 'publisher',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (namespace, user_id)
);

-- NodeDef entries (one row per namespace/name, points to latest version)
CREATE TABLE nodedefs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace       TEXT NOT NULL,
    name            TEXT NOT NULL,
    latest_version  TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    description     TEXT NOT NULL,
    icon            TEXT NOT NULL,
    tags            TEXT NOT NULL DEFAULT '[]',
    shape           TEXT NOT NULL,
    publisher_id    INTEGER NOT NULL REFERENCES users(id),
    total_downloads INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(namespace, name)
);

-- Version-specific data (immutable once published)
CREATE TABLE nodedef_versions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nodedef_id   INTEGER NOT NULL REFERENCES nodedefs(id),
    version      TEXT NOT NULL,
    yaml_blob    TEXT NOT NULL,
    metadata     TEXT NOT NULL,
    spec         TEXT NOT NULL,
    downloads    INTEGER NOT NULL DEFAULT 0,
    published_by INTEGER NOT NULL REFERENCES users(id),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(nodedef_id, version)
);

-- FTS5 virtual table for full-text search (regular mode, stores own copy)
CREATE VIRTUAL TABLE fts_nodedefs USING fts5(
    namespace,
    name,
    display_name,
    description,
    tags,
    tokenize='porter unicode61'
);

-- Download tracking for trending (per-day bucketing)
CREATE TABLE download_events (
    nodedef_id  INTEGER NOT NULL REFERENCES nodedefs(id),
    version     TEXT NOT NULL,
    day         TEXT NOT NULL,
    count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (nodedef_id, version, day)
);

-- Indexes
CREATE INDEX idx_nodedefs_namespace ON nodedefs(namespace);
CREATE INDEX idx_nodedefs_updated ON nodedefs(updated_at);
CREATE INDEX idx_nodedefs_downloads ON nodedefs(total_downloads DESC);
CREATE INDEX idx_versions_nodedef ON nodedef_versions(nodedef_id);
CREATE INDEX idx_download_events_day ON download_events(day);
CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_prefix ON api_tokens(prefix);

-- Seed reserved namespaces (built-in namespaces cannot be claimed)
INSERT INTO namespaces (name, owner_id, reserved) VALUES
  ('compute', NULL, 1),
  ('data', NULL, 1),
  ('messaging', NULL, 1),
  ('network', NULL, 1),
  ('client', NULL, 1),
  ('integration', NULL, 1),
  ('security', NULL, 1),
  ('observability', NULL, 1),
  ('ai', NULL, 1);
