import type { ResolvedConfig } from "./config.js";
import type { MemoryItem, QmdSearchResult } from "./types.js";
export interface QmdUpsertResult {
    ok: boolean;
    skipped: false;
}
export interface QmdSearchResponse {
    ok: boolean;
    skipped: false;
    results: QmdSearchResult[];
}
export declare class QmdAdapter {
    private readonly db;
    private readonly hasFts;
    constructor(config: ResolvedConfig);
    close(): void;
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
