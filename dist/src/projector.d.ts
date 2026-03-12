import type { ResolvedConfig } from "./config.js";
import type { MemoryItem } from "./types.js";
export declare function projectionPathForItem(config: ResolvedConfig, item: MemoryItem): string;
export declare function writeProjection(config: ResolvedConfig, item: MemoryItem): string;
export declare function removeProjection(config: ResolvedConfig, item: MemoryItem): void;
