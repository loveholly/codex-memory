import type { JudgeDecision, MemoryCandidate, MemoryKind, MemoryLifecycle, MemoryRetrieval, MemorySensitivity } from "./types.js";
declare function inferKind(candidate: Pick<MemoryCandidate, "summary" | "body">): MemoryKind;
declare function inferSensitivity(candidate: Pick<MemoryCandidate, "summary" | "body">): MemorySensitivity;
declare function inferLifecycle(candidate: Pick<MemoryCandidate, "summary" | "body">, kind: MemoryKind, stability: number): MemoryLifecycle;
declare function inferRetrieval(input: {
    kind: MemoryKind;
    lifecycle: MemoryLifecycle;
    sensitivity: MemorySensitivity;
    scope: "global" | "project";
    stability: number;
}): MemoryRetrieval;
declare function reviewAtForLifecycle(createdAt: number, lifecycle: MemoryLifecycle, kind: MemoryKind, sensitivity: MemorySensitivity): number | null;
export declare function judgeCandidate(candidate: MemoryCandidate): JudgeDecision;
export { inferKind, inferLifecycle, inferRetrieval, inferSensitivity, reviewAtForLifecycle };
