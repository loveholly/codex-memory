import { DatabaseSync } from "node:sqlite";
function jsonParseTags(text) {
    try {
        const value = JSON.parse(text);
        return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
    }
    catch {
        return [];
    }
}
function rowToItem(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        scope: row.scope,
        projectId: row.project_id,
        kind: row.kind,
        summary: row.summary,
        body: row.body,
        confidence: row.confidence,
        importance: row.importance,
        stability: row.stability,
        status: row.status,
        dedupeKey: row.dedupe_key,
        sourceThreadId: row.source_thread_id,
        sourceTitle: row.source_title,
        sourceCwd: row.source_cwd,
        tags: jsonParseTags(row.tags_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at
    };
}
function scopeClause(input) {
    if (input.scope === "global") {
        return { sql: "scope = 'global'", params: [] };
    }
    if (input.scope === "project") {
        return { sql: "scope = 'project' AND project_id = ?", params: [input.projectId || ""] };
    }
    if (input.projectId) {
        return {
            sql: "(scope = 'global' OR (scope = 'project' AND project_id = ?))",
            params: [input.projectId]
        };
    }
    return { sql: "scope = 'global'", params: [] };
}
export class MemoryStore {
    db;
    constructor(dbPath) {
        this.db = new DatabaseSync(dbPath);
        this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        project_id TEXT,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        confidence REAL NOT NULL,
        importance REAL NOT NULL,
        stability REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        dedupe_key TEXT NOT NULL,
        source_thread_id TEXT,
        source_title TEXT,
        source_cwd TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_memory_items_scope_status
      ON memory_items (scope, project_id, status, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_memory_items_dedupe
      ON memory_items (dedupe_key, status);

      CREATE TABLE IF NOT EXISTS memory_links (
        src_id TEXT NOT NULL,
        dst_id TEXT NOT NULL,
        rel TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_links_src
      ON memory_links (src_id, rel);
    `);
    }
    close() {
        this.db.close();
    }
    getItem(id) {
        const statement = this.db.prepare("SELECT * FROM memory_items WHERE id = ?");
        return rowToItem(statement.get(id));
    }
    listContext(input) {
        const limit = input.limit ?? 5;
        const globalRows = this.db
            .prepare(`
          SELECT * FROM memory_items
          WHERE status = 'active' AND scope = 'global'
          ORDER BY importance DESC, updated_at DESC
          LIMIT ?
        `)
            .all(limit);
        const projectRows = input.projectId
            ? this.db
                .prepare(`
              SELECT * FROM memory_items
              WHERE status = 'active' AND scope = 'project' AND project_id = ?
              ORDER BY importance DESC, updated_at DESC
              LIMIT ?
            `)
                .all(input.projectId, limit)
            : [];
        return {
            global: globalRows.map((row) => rowToItem(row)).filter((item) => item !== null),
            project: projectRows.map((row) => rowToItem(row)).filter((item) => item !== null)
        };
    }
    search(input) {
        const clause = scopeClause({ scope: input.scope || "auto", projectId: input.projectId });
        const limit = input.limit ?? 8;
        const searchText = `%${input.query.toLowerCase()}%`;
        const rows = this.db
            .prepare(`
          SELECT *
          FROM memory_items
          WHERE status = 'active'
            AND ${clause.sql}
            AND (
              lower(summary) LIKE ?
              OR lower(body) LIKE ?
              OR lower(tags_json) LIKE ?
            )
          ORDER BY importance DESC, updated_at DESC
          LIMIT ?
        `)
            .all(...clause.params, searchText, searchText, searchText, limit);
        return rows.map((row) => rowToItem(row)).filter((item) => item !== null);
    }
    remember(item) {
        const existing = this.db
            .prepare(`
          SELECT *
          FROM memory_items
          WHERE dedupe_key = ?
            AND status = 'active'
            AND scope = ?
            AND coalesce(project_id, '') = coalesce(?, '')
          LIMIT 1
        `)
            .get(item.dedupeKey, item.scope, item.projectId);
        if (existing) {
            this.db
                .prepare(`
            UPDATE memory_items
            SET
              kind = ?,
              summary = ?,
              body = ?,
              confidence = ?,
              importance = ?,
              stability = ?,
              source_thread_id = ?,
              source_title = ?,
              source_cwd = ?,
              tags_json = ?,
              updated_at = ?,
              expires_at = ?
            WHERE id = ?
          `)
                .run(item.kind, item.summary, item.body, item.confidence, item.importance, item.stability, item.sourceThreadId, item.sourceTitle, item.sourceCwd, JSON.stringify(item.tags), item.updatedAt, item.expiresAt, existing.id);
            return this.getItem(existing.id);
        }
        this.db
            .prepare(`
          INSERT INTO memory_items (
            id, scope, project_id, kind, summary, body,
            confidence, importance, stability, status, dedupe_key,
            source_thread_id, source_title, source_cwd, tags_json,
            created_at, updated_at, expires_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
            .run(item.id, item.scope, item.projectId, item.kind, item.summary, item.body, item.confidence, item.importance, item.stability, item.status, item.dedupeKey, item.sourceThreadId, item.sourceTitle, item.sourceCwd, JSON.stringify(item.tags), item.createdAt, item.updatedAt, item.expiresAt);
        return this.getItem(item.id);
    }
    dismiss(id, timestamp) {
        this.db.prepare("UPDATE memory_items SET status = 'dismissed', updated_at = ? WHERE id = ?").run(timestamp, id);
        return this.getItem(id);
    }
    supersede(id, byId, timestamp) {
        this.db.prepare("UPDATE memory_items SET status = 'superseded', updated_at = ? WHERE id = ?").run(timestamp, id);
        this.db.prepare("INSERT INTO memory_links (src_id, dst_id, rel, created_at) VALUES (?, ?, 'superseded_by', ?)").run(id, byId, timestamp);
        return this.getItem(id);
    }
    promote(id, replacement) {
        this.db.prepare("UPDATE memory_items SET status = 'superseded', updated_at = ? WHERE id = ?").run(replacement.updatedAt, id);
        this.db.prepare("INSERT INTO memory_links (src_id, dst_id, rel, created_at) VALUES (?, ?, 'promoted_to', ?)").run(id, replacement.id, replacement.updatedAt);
        return this.remember(replacement);
    }
}
//# sourceMappingURL=store.js.map