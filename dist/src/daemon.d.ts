import type { DaemonRequest, MemoryItem, QmdSearchResult } from "./types.js";
import { type ResolvedConfig } from "./config.js";
import { type QmdSearchResponse } from "./qmd.js";
export interface SearchResponse {
    ok: true;
    source: "qmd" | "sqlite" | "sqlite_fallback" | "none";
    projectId: string | null;
    results: Array<MemoryItem | QmdSearchResult>;
    qmd?: QmdSearchResponse;
}
export interface ContextResponse {
    ok: true;
    projectId: string | null;
    global: MemoryItem[];
    project: MemoryItem[];
    related: Array<MemoryItem | QmdSearchResult>;
    relatedSource: SearchResponse["source"];
}
type DaemonResponse = Record<string, unknown> | ContextResponse | SearchResponse;
export declare class MemoryDaemon {
    private readonly config;
    private readonly store;
    private readonly qmd;
    private readonly server;
    private idleTimer;
    constructor(config: ResolvedConfig);
    start(): Promise<void>;
    dispose(): Promise<void>;
    private getEndpoint;
    private bumpIdle;
    private shutdown;
    private handleConnection;
    dispatch(request: DaemonRequest): Promise<DaemonResponse>;
    private capture;
    private context;
    private search;
    private dismiss;
    private promote;
    private supersede;
}
export {};
