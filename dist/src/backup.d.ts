import type { ResolvedConfig } from "./config.js";
export interface BackupStatus {
    ok: boolean;
    enabled: boolean;
    repoUrl: string;
    branch: string;
    worktreeDir: string;
    snapshotPath: string;
    autoPush: boolean;
}
export interface BackupPushResult {
    ok: boolean;
    skipped: boolean;
    branch: string;
    snapshotPath: string;
    worktreeDir: string;
    commit?: string;
    reason?: string;
    error?: string;
}
export declare function getBackupStatus(config: ResolvedConfig): BackupStatus;
export declare function pushBackup(config: ResolvedConfig, reason: string): BackupPushResult;
