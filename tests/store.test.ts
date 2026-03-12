import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { MemoryStore } from "../src/store.js";
import type { MemoryItem } from "../src/types.js";

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: overrides.id || "item-1",
    scope: overrides.scope || "project",
    projectId: overrides.projectId ?? "repo-123",
    kind: overrides.kind || "decision",
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
    store.remember(makeItem({ id: "global-1", scope: "global", projectId: null, dedupeKey: "global-1", summary: "Global memory" }));
    store.remember(makeItem({ id: "project-1", scope: "project", projectId: "repo-a", dedupeKey: "project-1", summary: "Project A memory" }));
    store.remember(makeItem({ id: "project-2", scope: "project", projectId: "repo-b", dedupeKey: "project-2", summary: "Project B memory" }));

    const context = store.listContext({ projectId: "repo-a", limit: 5 });
    assert.equal(context.global.length, 1);
    assert.equal(context.project.length, 1);
    assert.equal(context.project[0]?.summary, "Project A memory");
  } finally {
    store.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
