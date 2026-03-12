import type { MemoryItem } from "./types.js";
export interface MemoryLink {
    srcId: string;
    dstId: string;
    rel: string;
    createdAt: number;
}
export interface MemoryBackupData {
    items: MemoryItem[];
    links: MemoryLink[];
}
export interface ContextItems {
    global: MemoryItem[];
    project: MemoryItem[];
}
export declare class MemoryStore {
    private readonly db;
    constructor(dbPath: string);
    private migrateMemoryItems;
    close(): void;
    getItem(id: string): MemoryItem | null;
    getItems(ids: string[]): MemoryItem[];
    listContext(input: {
        projectId: string | null;
        limit?: number;
    }): ContextItems;
    search(input: {
        query: string;
        scope?: "auto" | "global" | "project";
        projectId: string | null;
        limit?: number;
        includeFallback?: boolean;
    }): MemoryItem[];
    exportData(): MemoryBackupData;
    remember(item: MemoryItem): MemoryItem;
    dismiss(id: string, timestamp: number): MemoryItem | null;
    supersede(id: string, byId: string, timestamp: number): MemoryItem | null;
    promote(id: string, replacement: MemoryItem): MemoryItem;
}
