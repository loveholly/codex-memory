import type { MemoryItem } from "./types.js";
export interface ContextItems {
    global: MemoryItem[];
    project: MemoryItem[];
}
export declare class MemoryStore {
    private readonly db;
    constructor(dbPath: string);
    close(): void;
    getItem(id: string): MemoryItem | null;
    listContext(input: {
        projectId: string | null;
        limit?: number;
    }): ContextItems;
    search(input: {
        query: string;
        scope?: "auto" | "global" | "project";
        projectId: string | null;
        limit?: number;
    }): MemoryItem[];
    remember(item: MemoryItem): MemoryItem;
    dismiss(id: string, timestamp: number): MemoryItem | null;
    supersede(id: string, byId: string, timestamp: number): MemoryItem | null;
    promote(id: string, replacement: MemoryItem): MemoryItem;
}
