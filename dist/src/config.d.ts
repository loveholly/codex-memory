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
}
export declare function resolveConfig(env?: NodeJS.ProcessEnv): ResolvedConfig;
export declare function ensureRuntimeDirs(config: ResolvedConfig): void;
