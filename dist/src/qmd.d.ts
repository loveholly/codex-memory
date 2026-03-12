import type { ResolvedConfig } from "./config.js";
import type { MemoryItem, QmdSearchResult } from "./types.js";
export interface QmdUpsertResult {
    ok: boolean;
    skipped: boolean;
    reason?: string;
    stderr?: string;
    stdout?: string;
}
export interface QmdSearchResponse {
    ok: boolean;
    skipped: boolean;
    results: QmdSearchResult[];
    stderr?: string;
    stdout?: string;
}
export declare class QmdAdapter {
    private readonly config;
    constructor(config: ResolvedConfig);
    upsert(input: {
        item: MemoryItem;
        filePath: string;
    }): QmdUpsertResult;
    search(input: {
        query: string;
        scope: "auto" | "global" | "project";
        projectId: string | null;
        limit: number;
    }): QmdSearchResponse;
}
