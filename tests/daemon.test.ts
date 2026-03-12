import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { MemoryDaemon } from "../src/daemon";
import { resolveConfig } from "../src/config";

function makeConfig(tempRoot: string) {
  return resolveConfig({
    ...process.env,
    CODEX_MEMORY_HOME: path.join(tempRoot, "home"),
    CODEX_MEMORY_RUN_DIR: path.join(tempRoot, "run"),
    CODEX_MEMORY_IDLE_MS: "5000"
  });
}

test("daemon dispatch captures, searches, and dismisses without binding a listener", async () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-memory-daemon-"));
  const daemon = new MemoryDaemon(makeConfig(tempRoot));

  try {
    const capture = await daemon.dispatch({
      command: "capture",
      args: {
        cwd: "/tmp/repo",
        summary: "This repo should load durable memory before large implementations",
        body: "Current repo workflow: load durable memory before large implementations so follow-up work keeps the same decision context."
      }
    });

    assert.equal(capture.ok, true);
    const captureRecord = capture as Record<string, unknown>;
    assert.equal(captureRecord.skipped, false);

    const context = await daemon.dispatch({
      command: "context",
      args: {
        cwd: "/tmp/repo",
        query: "durable memory"
      }
    });

    const contextRecord = context as Record<string, unknown>;
    assert.equal(Array.isArray(contextRecord.project), true);
    assert.equal((contextRecord.project as unknown[]).length, 1);

    const search = await daemon.dispatch({
      command: "search",
      args: {
        cwd: "/tmp/repo",
        query: "durable memory"
      }
    });

    const searchRecord = search as Record<string, unknown>;
    assert.equal(searchRecord.source, "qmd");
    assert.equal(Array.isArray(searchRecord.results), true);
    assert.equal((searchRecord.results as unknown[]).length, 1);

    const itemId = ((captureRecord.item as { id?: string } | undefined)?.id as string | undefined) || "";
    const dismiss = await daemon.dispatch({
      command: "dismiss",
      args: { id: itemId }
    });

    const dismissRecord = dismiss as Record<string, unknown>;
    assert.equal((dismissRecord.item as { status?: string } | undefined)?.status, "dismissed");
  } finally {
    await daemon.dispose();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
