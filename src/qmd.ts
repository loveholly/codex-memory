import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ResolvedConfig } from "./config.js";
import type { MemoryItem, QmdSearchResult } from "./types.js";

export interface QmdUpsertResult {
  ok: boolean;
  skipped: false;
}

export interface QmdSearchResponse {
  ok: boolean;
  skipped: false;
  results: QmdSearchResult[];
}

export class QmdAdapter {
  private readonly db: DatabaseSync;
  private readonly hasFts: boolean;

  constructor(config: ResolvedConfig) {
    mkdirSync(path.dirname(config.qmdDbPath), { recursive: true });
    this.db = new DatabaseSync(config.qmdDbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS qmd_documents (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        project_id TEXT,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        summary TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_qmd_documents_scope
      ON qmd_documents (scope, project_id, updated_at DESC);
    `);

    let hasFts = true;
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS qmd_documents_fts
        USING fts5(id UNINDEXED, summary, body, tags);
      `);
    } catch {
      hasFts = false;
    }

    this.hasFts = hasFts;
  }

  close(): void {
    this.db.close();
  }

  upsert(input: { item: MemoryItem; filePath: string }): QmdUpsertResult {
    this.db
      .prepare(
        `
          INSERT INTO qmd_documents (
            id, scope, project_id, kind, file_path, summary, body, tags_json, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            scope = excluded.scope,
            project_id = excluded.project_id,
            kind = excluded.kind,
            file_path = excluded.file_path,
            summary = excluded.summary,
            body = excluded.body,
            tags_json = excluded.tags_json,
            updated_at = excluded.updated_at
        `
      )
      .run(
        input.item.id,
        input.item.scope,
        input.item.projectId,
        input.item.kind,
        input.filePath,
        input.item.summary,
        input.item.body,
        JSON.stringify(input.item.tags),
        input.item.updatedAt
      );

    if (this.hasFts) {
      this.db.prepare("DELETE FROM qmd_documents_fts WHERE id = ?").run(input.item.id);
      this.db
        .prepare("INSERT INTO qmd_documents_fts (id, summary, body, tags) VALUES (?, ?, ?, ?)")
        .run(input.item.id, input.item.summary, input.item.body, input.item.tags.join(" "));
    }

    return { ok: true, skipped: false };
  }

  search(input: { query: string; scope: "auto" | "global" | "project"; projectId: string | null; limit: number }): QmdSearchResponse {
    if (this.hasFts) {
      const tokens = input.query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => `${token.replace(/"/g, '""')}*`)
        .join(" OR ");

      if (tokens) {
        const rows = this.db
          .prepare(
            `
              SELECT
                d.id,
                d.file_path,
                d.summary,
                bm25(qmd_documents_fts) AS score
              FROM qmd_documents_fts
              JOIN qmd_documents d ON d.id = qmd_documents_fts.id
              WHERE qmd_documents_fts MATCH ?
                AND (
                  ? = 'global'
                  AND d.scope = 'global'
                  OR ? = 'project'
                  AND d.scope = 'project'
                  AND coalesce(d.project_id, '') = coalesce(?, '')
                  OR ? = 'auto'
                  AND (
                    d.scope = 'global'
                    OR (d.scope = 'project' AND coalesce(d.project_id, '') = coalesce(?, ''))
                  )
                )
              ORDER BY score, d.updated_at DESC
              LIMIT ?
            `
          )
          .all(tokens, input.scope, input.scope, input.projectId, input.scope, input.projectId, input.limit) as unknown as Array<{
          id: string;
          file_path: string;
          summary: string;
          score: number;
        }>;

        return {
          ok: true,
          skipped: false,
          results: rows.map((row) => ({
            id: row.id,
            file_path: row.file_path,
            summary: row.summary,
            score: row.score
          }))
        };
      }
    }

    const searchText = `%${input.query.toLowerCase()}%`;
    const rows = this.db
      .prepare(
        `
          SELECT id, file_path, summary, updated_at
          FROM qmd_documents
          WHERE (
            ? = 'global'
            AND scope = 'global'
            OR ? = 'project'
            AND scope = 'project'
            AND coalesce(project_id, '') = coalesce(?, '')
            OR ? = 'auto'
            AND (
              scope = 'global'
              OR (scope = 'project' AND coalesce(project_id, '') = coalesce(?, ''))
            )
          )
            AND (
              lower(summary) LIKE ?
              OR lower(body) LIKE ?
              OR lower(tags_json) LIKE ?
            )
          ORDER BY updated_at DESC
          LIMIT ?
        `
      )
      .all(input.scope, input.scope, input.projectId, input.scope, input.projectId, searchText, searchText, searchText, input.limit) as unknown as Array<{
      id: string;
      file_path: string;
      summary: string;
      updated_at: number;
    }>;

    return {
      ok: true,
      skipped: false,
      results: rows.map((row) => ({
        id: row.id,
        file_path: row.file_path,
        summary: row.summary,
        score: row.updated_at
      }))
    };
  }
}
