import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { resolveConfig } from "../src/config.js";
import { writeProjection } from "../src/projector.js";
import { QmdAdapter } from "../src/qmd.js";
function makeItem(tempRoot) {
    return {
        id: "memory-1",
        scope: "project",
        projectId: "repo-1",
        kind: "decision",
        lifecycle: "active",
        sensitivity: "internal",
        retrieval: "context",
        summary: "Label workflow memory",
        body: "Labels should keep detail context synchronized across sessions.",
        confidence: 0.9,
        importance: 0.8,
        stability: 0.7,
        status: "active",
        dedupeKey: "memory-1",
        sourceThreadId: null,
        sourceTitle: "label workflow",
        sourceCwd: path.join(tempRoot, "repo"),
        tags: ["labels", "workflow"],
        createdAt: 1,
        updatedAt: 2,
        reviewAt: null,
        expiresAt: null
    };
}
test("qmd adapter indexes and searches using the vendored @tobilu/qmd runtime", async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-memory-qmd-"));
    const config = resolveConfig({
        ...process.env,
        CODEX_MEMORY_HOME: path.join(tempRoot, "home"),
        CODEX_MEMORY_RUN_DIR: path.join(tempRoot, "run")
    });
    const qmd = new QmdAdapter(config);
    try {
        const item = makeItem(tempRoot);
        const projectionPath = writeProjection(config, item);
        await qmd.upsert({ item, filePath: projectionPath });
        const result = await qmd.search({
            query: "detail context",
            scope: "auto",
            projectId: "repo-1",
            limit: 5
        });
        assert.equal(result.ok, true);
        assert.equal(result.results.length, 1);
        assert.equal(result.results[0]?.id, item.id);
    }
    finally {
        await qmd.close();
        rmSync(tempRoot, { recursive: true, force: true });
    }
});
//# sourceMappingURL=qmd.test.js.map