import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { MemoryStore } from "./store.js";
import { isoTime, toJson } from "./utils.js";
function repoSnapshotPath(config) {
    return config.backup.snapshotPath.replace(/^[/\\]+/, "");
}
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
function tryRunGit(args, cwd) {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8"
    });
    return {
        ok: result.status === 0,
        stdout: String(result.stdout || "").trim(),
        stderr: String(result.stderr || "").trim()
    };
}
function ensureBackupRepo(config) {
    const worktreeDir = config.backup.worktreeDir;
    const worktreeParent = path.dirname(worktreeDir);
    mkdirSync(worktreeParent, { recursive: true });
    if (!existsSync(path.join(worktreeDir, ".git"))) {
        if (!existsSync(worktreeDir)) {
            runGit(["clone", config.backup.repoUrl, worktreeDir], worktreeParent);
        }
        else if (!existsSync(path.join(worktreeDir, ".git"))) {
            rmSync(worktreeDir, { recursive: true, force: true });
            runGit(["clone", config.backup.repoUrl, worktreeDir], worktreeParent);
        }
    }
    runGit(["config", "user.name", config.backup.gitUserName], worktreeDir);
    runGit(["config", "user.email", config.backup.gitUserEmail], worktreeDir);
    const remoteExists = tryRunGit(["remote", "get-url", "origin"], worktreeDir);
    if (remoteExists.ok) {
        runGit(["remote", "set-url", "origin", config.backup.repoUrl], worktreeDir);
    }
    else {
        runGit(["remote", "add", "origin", config.backup.repoUrl], worktreeDir);
    }
    const remoteBranch = tryRunGit(["ls-remote", "--heads", config.backup.repoUrl, config.backup.branch], worktreeDir);
    if (remoteBranch.ok && remoteBranch.stdout) {
        runGit(["fetch", "origin", config.backup.branch, "--depth", "1"], worktreeDir);
        runGit(["checkout", "-B", config.backup.branch, "FETCH_HEAD"], worktreeDir);
        return;
    }
    runGit(["checkout", "-B", config.backup.branch], worktreeDir);
}
function writeSnapshot(config, reason) {
    const snapshotRoot = path.join(config.backup.worktreeDir, repoSnapshotPath(config));
    rmSync(snapshotRoot, { recursive: true, force: true });
    mkdirSync(snapshotRoot, { recursive: true });
    const store = new MemoryStore(config.dbPath);
    try {
        const exported = store.exportData();
        writeFileSync(path.join(snapshotRoot, "memory.json"), `${toJson({
            host: os.hostname(),
            formatVersion: 1,
            source: {
                dbPath: config.dbPath,
                projectionsDir: config.projectionsDir
            },
            items: exported.items,
            links: exported.links
        })}\n`, "utf8");
    }
    finally {
        store.close();
    }
    const projectionsTarget = path.join(snapshotRoot, "projections");
    cpSync(config.projectionsDir, projectionsTarget, { recursive: true });
    writeFileSync(path.join(snapshotRoot, "manifest.json"), `${toJson({
        host: os.hostname(),
        formatVersion: 1,
        source: "codex-memory",
        files: ["memory.json", "manifest.json", "projections/"]
    })}\n`, "utf8");
    return snapshotRoot;
}
export function getBackupStatus(config) {
    return {
        ok: true,
        enabled: config.backup.enabled,
        repoUrl: config.backup.repoUrl,
        branch: config.backup.branch,
        worktreeDir: config.backup.worktreeDir,
        snapshotPath: repoSnapshotPath(config),
        autoPush: config.backup.autoPush
    };
}
export function pushBackup(config, reason) {
    if (!config.backup.enabled) {
        return {
            ok: false,
            skipped: true,
            branch: config.backup.branch,
            snapshotPath: repoSnapshotPath(config),
            worktreeDir: config.backup.worktreeDir,
            reason: "backup_not_configured",
            error: "Backup repo is not configured"
        };
    }
    try {
        ensureBackupRepo(config);
        writeSnapshot(config, reason);
        runGit(["add", "."], config.backup.worktreeDir);
        const status = runGit(["status", "--short"], config.backup.worktreeDir);
        if (!status) {
            return {
                ok: true,
                skipped: true,
                branch: config.backup.branch,
                snapshotPath: repoSnapshotPath(config),
                worktreeDir: config.backup.worktreeDir,
                reason: "no_changes"
            };
        }
        const commitMessage = `backup: ${reason} ${isoTime(Date.now())}`;
        runGit(["commit", "-m", commitMessage], config.backup.worktreeDir);
        runGit(["push", "-u", "origin", config.backup.branch], config.backup.worktreeDir);
        const commit = runGit(["rev-parse", "HEAD"], config.backup.worktreeDir);
        return {
            ok: true,
            skipped: false,
            branch: config.backup.branch,
            snapshotPath: repoSnapshotPath(config),
            worktreeDir: config.backup.worktreeDir,
            commit
        };
    }
    catch (error) {
        return {
            ok: false,
            skipped: false,
            branch: config.backup.branch,
            snapshotPath: repoSnapshotPath(config),
            worktreeDir: config.backup.worktreeDir,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
//# sourceMappingURL=backup.js.map