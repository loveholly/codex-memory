import type { ResolvedConfig } from "./config.js";
import type { MemoryItem, MemoryScope, QmdSearchResult } from "./types.js";
export interface QmdUpsertResult {
    ok: boolean;
    skipped: false;
    error?: string;
}
export interface QmdSearchResponse {
    ok: boolean;
    skipped: false;
    results: QmdSearchResult[];
    error?: string;
}
export declare class QmdAdapter {
    private readonly config;
    private storePromise;
    constructor(config: ResolvedConfig);
    private getStore;
    close(): Promise<void>;
    private ensureCollection;
    refreshScope(scope: MemoryScope, projectId: string | null): Promise<QmdUpsertResult>;
    upsert(input: {
        item: MemoryItem;
        filePath: string;
    }): Promise<QmdUpsertResult>;
    search(input: {
        query: string;
        scope: "auto" | "global" | "project";
        projectId: string | null;
        limit: number;
    }): Promise<QmdSearchResponse>;
}
