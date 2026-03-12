import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { MemoryStore } from "../src/store";
import type { MemoryItem } from "../src/types";

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: overrides.id || "item-1",
    scope: overrides.scope || "project",
    projectId: overrides.projectId ?? "repo-123",
    kind: overrides.kind || "decision",
    lifecycle: overrides.lifecycle || "active",
    sensitivity: overrides.sensitivity || "internal",
    retrieval: overrides.retrieval || "context",
    summary: overrides.summary || "Repository memory summary",
    body: overrides.body || "Repository memory body",
    confidence: overrides.confidence ?? 0.9,
    importance: overrides.importance ?? 0.8,
    stability: overrides.stability ?? 0.7,
    status: overrides.status || "active",
    dedupeKey: overrides.dedupeKey || "dedupe-1",
    sourceThreadId: overrides.sourceThreadId ?? "thread-1",
    sourceTitle: overrides.sourceTitle ?? "title",
    sourceCwd: overrides.sourceCwd ?? "/tmp/repo",
    tags: overrides.tags || ["memory"],
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    reviewAt: overrides.reviewAt ?? null,
    expiresAt: overrides.expiresAt ?? null
  };
}

test("store remembers and dedupes memory items", () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-memory-store-"));
  const store = new MemoryStore(path.join(tempRoot, "memory.db"));

  try {
    const first = store.remember(makeItem());
    const second = store.remember(
      makeItem({
        id: "item-2",
        body: "Updated body",
        updatedAt: 2
      })
    );

    assert.equal(first.id, second.id);
    assert.equal(second.body, "Updated body");
    assert.equal(store.search({ query: "updated body", projectId: "repo-123" }).length, 1);
  } finally {
    store.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("store separates global and project context", () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-memory-context-"));
  const store = new MemoryStore(path.join(tempRoot, "memory.db"));

  try {
    store.remember(makeItem({ id: "global-1", scope: "global", projectId: null, dedupeKey: "global-1", retrieval: "always", summary: "Global memory" }));
    store.remember(makeItem({ id: "project-1", scope: "project", projectId: "repo-a", dedupeKey: "project-1", summary: "Project A memory" }));
    store.remember(makeItem({ id: "project-2", scope: "project", projectId: "repo-b", dedupeKey: "project-2", summary: "Project B memory" }));
    store.remember(makeItem({ id: "query-only", scope: "project", projectId: "repo-a", dedupeKey: "query-only", retrieval: "query", summary: "Query only memory" }));

    const context = store.listContext({ projectId: "repo-a", limit: 5 });
    assert.equal(context.global.length, 1);
    assert.equal(context.project.length, 1);
    assert.equal(context.project[0]?.summary, "Project A memory");
  } finally {
    store.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("store search hides manual items and includes fallback when requested", () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-memory-search-"));
  const store = new MemoryStore(path.join(tempRoot, "memory.db"));

  try {
    store.remember(makeItem({ id: "manual-1", dedupeKey: "manual-1", retrieval: "manual", summary: "Manual recovery note", body: "Manual recovery note" }));
    store.remember(makeItem({ id: "fallback-1", dedupeKey: "fallback-1", retrieval: "fallback", lifecycle: "stale", summary: "Fallback memory", body: "Fallback memory body" }));

    assert.equal(store.search({ query: "manual recovery", projectId: "repo-123", includeFallback: true }).length, 0);

    const primary = store.search({ query: "fallback memory", projectId: "repo-123", includeFallback: false });
    const fallback = store.search({ query: "fallback memory", projectId: "repo-123", includeFallback: true });
    assert.equal(primary.length, 0);
    assert.equal(fallback.length, 1);
    assert.equal(fallback[0]?.retrieval, "fallback");
  } finally {
    store.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
