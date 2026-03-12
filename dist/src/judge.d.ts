import type { JudgeDecision, MemoryCandidate, MemoryKind } from "./types.js";
export declare function inferKind(candidate: Pick<MemoryCandidate, "summary" | "body">): MemoryKind;
export declare function judgeCandidate(candidate: MemoryCandidate): JudgeDecision;
