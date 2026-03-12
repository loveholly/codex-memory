import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pushBackup } from "../src/backup.js";
import { resolveConfig } from "../src/config.js";
import { MemoryDaemon } from "../src/daemon.js";
function runGit(args, cwd) {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8"
    });
    if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
    }
    return String(result.stdout || "").trim();
}
function makeConfig(tempRoot, remoteRepo) {
    return resolveConfig({
        ...process.env,
        CODEX_MEMORY_HOME: path.join(tempRoot, "home"),
        CODEX_MEMORY_RUN_DIR: path.join(tempRoot, "run"),
        CODEX_MEMORY_IDLE_MS: "5000",
        CODEX_MEMORY_BACKUP_REPO: remoteRepo,
        CODEX_MEMORY_BACKUP_WORKTREE: path.join(tempRoot, "backup-worktree"),
        CODEX_MEMORY_BACKUP_GIT_NAME: "codex-memory-test",
        CODEX_MEMORY_BACKUP_GIT_EMAIL: "codex-memory-test@example.com"
    });
}
test("pushBackup exports canonical memory and projections to a git remote", async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-memory-backup-"));
    const remoteRepo = path.join(tempRoot, "remote.git");
    runGit(["init", "--bare", remoteRepo], tempRoot);
    const config = makeConfig(tempRoot, remoteRepo);
    const daemon = new MemoryDaemon(config);
    try {
        const capture = await daemon.dispatch({
            command: "capture",
            args: {
                cwd: "/tmp/repo",
                summary: "Backup this durable memory",
                body: "This backup should land in the remote repository as canonical JSON plus projections."
            }
        });
        assert.equal(capture.ok, true);
        const pushed = pushBackup(config, "test-backup");
        assert.equal(pushed.ok, true);
        assert.equal(pushed.skipped, false);
        assert.match(String(pushed.commit || ""), /^[0-9a-f]{40}$/);
        const memoryJson = runGit(["--git-dir", remoteRepo, "show", `main:${config.backup.snapshotPath}/memory.json`], tempRoot);
        const exported = JSON.parse(memoryJson);
        assert.equal(exported.items.length, 1);
        assert.equal(exported.items[0]?.summary, "Backup this durable memory");
        const pushedAgain = pushBackup(config, "test-backup");
        assert.equal(pushedAgain.ok, true);
        assert.equal(pushedAgain.skipped, true);
        assert.equal(pushedAgain.reason, "no_changes");
    }
    finally {
        await daemon.dispose();
        rmSync(tempRoot, { recursive: true, force: true });
    }
});
//# sourceMappingURL=backup.test.js.map