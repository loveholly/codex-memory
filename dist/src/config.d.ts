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
export declare function resolveConfig(env?: NodeJS.ProcessEnv): ResolvedConfig;
export declare function ensureRuntimeDirs(config: ResolvedConfig): void;
