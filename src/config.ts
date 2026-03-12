import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { slugify } from "./utils";

export interface BackupConfig {
  enabled: boolean;
  repoUrl: string;
  branch: string;
  worktreeDir: string;
  snapshotPath: string;
  autoPush: boolean;
  gitUserName: string;
  gitUserEmail: string;
}

export interface ResolvedConfig {
  codexHome: string;
  baseDir: string;
  runDir: string;
  dbPath: string;
  qmdDbPath: string;
  projectionsDir: string;
  host: string;
  port: number;
  endpointPath: string;
  pidPath: string;
  idleMs: number;
  backup: BackupConfig;
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): ResolvedConfig {
  const codexHome = env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const baseDir = env.CODEX_MEMORY_HOME || path.join(codexHome, "memories", "codex-memory");
  const runDir = env.CODEX_MEMORY_RUN_DIR || path.join(codexHome, "run");
  const idleMs = Number(env.CODEX_MEMORY_IDLE_MS || 300000);
  const port = Number(env.CODEX_MEMORY_PORT || 0);
  const backupRepoUrl = String(env.CODEX_MEMORY_BACKUP_REPO || "").trim();
  const backupWorktreeDir = env.CODEX_MEMORY_BACKUP_WORKTREE || path.join(baseDir, "_backup_repo");
  const backupSnapshotPath = env.CODEX_MEMORY_BACKUP_PATH || path.join("snapshots", slugify(os.hostname()));

  return {
    codexHome,
    baseDir,
    runDir,
    dbPath: env.CODEX_MEMORY_DB || path.join(baseDir, "memory.db"),
    qmdDbPath: env.CODEX_MEMORY_QMD_DB || path.join(baseDir, "qmd.db"),
    projectionsDir: env.CODEX_MEMORY_PROJECTIONS || path.join(baseDir, "projections"),
    host: env.CODEX_MEMORY_HOST || "127.0.0.1",
    port: Number.isFinite(port) ? port : 0,
    endpointPath: env.CODEX_MEMORY_ENDPOINT || path.join(runDir, "codex-memoryd.json"),
    pidPath: env.CODEX_MEMORY_PID || path.join(runDir, "codex-memoryd.pid"),
    idleMs: Number.isFinite(idleMs) ? idleMs : 300000,
    backup: {
      enabled: backupRepoUrl.length > 0,
      repoUrl: backupRepoUrl,
      branch: env.CODEX_MEMORY_BACKUP_BRANCH || "main",
      worktreeDir: backupWorktreeDir,
      snapshotPath: backupSnapshotPath,
      autoPush: env.CODEX_MEMORY_BACKUP_AUTO_PUSH === "1",
      gitUserName: env.CODEX_MEMORY_BACKUP_GIT_NAME || "codex-memory",
      gitUserEmail: env.CODEX_MEMORY_BACKUP_GIT_EMAIL || "codex-memory@localhost"
    }
  };
}

export function ensureRuntimeDirs(config: ResolvedConfig): void {
  mkdirSync(config.baseDir, { recursive: true });
  mkdirSync(config.runDir, { recursive: true });
  mkdirSync(config.projectionsDir, { recursive: true });
  mkdirSync(path.join(config.projectionsDir, "global"), { recursive: true });
  mkdirSync(path.join(config.projectionsDir, "projects"), { recursive: true });
}
