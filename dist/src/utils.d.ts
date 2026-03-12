export declare function now(): number;
export declare function clamp(value: number, min: number, max: number): number;
export declare function hashText(text: string): string;
export declare function normalizeText(text: string | undefined | null): string;
export declare function slugify(value: string | undefined | null): string;
export declare function projectIdFromCwd(cwd: string | undefined): string;
export declare function isoTime(timestamp: number): string;
export declare function shellEscape(value: string | undefined | null): string;
export declare function expandTemplate(template: string, variables: Record<string, string>): string;
export declare function stableDedupeKey(input: {
    scope: string;
    projectId: string | null;
    kind: string;
    summary: string;
}): string;
export declare function toJson(value: unknown): string;
