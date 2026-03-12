export type MemoryScope = "global" | "project";
export type RequestedScope = MemoryScope | "auto";
export type MemoryStatus = "active" | "dismissed" | "superseded";
export type MemoryKind =
  | "preference"
  | "decision"
  | "constraint"
  | "open_loop"
  | "glossary"
  | "fact"
  | "procedure"
  | "plan"
  | "relationship";
export type MemoryLifecycle = "active" | "review" | "stale" | "expired";
export type MemorySensitivity = "public" | "internal" | "sensitive" | "secret";
export type MemoryRetrieval = "always" | "context" | "query" | "fallback" | "manual";

export interface MemoryCandidate {
  id?: string;
  cwd?: string;
  scope?: RequestedScope;
  kind?: MemoryKind | "";
  lifecycle?: MemoryLifecycle | "";
  sensitivity?: MemorySensitivity | "";
  retrieval?: MemoryRetrieval | "";
  summary: string;
  body?: string;
  threadId?: string;
  title?: string;
  tags?: string[];
}

export interface MemoryItem {
  id: string;
  scope: MemoryScope;
  projectId: string | null;
  kind: MemoryKind;
  lifecycle: MemoryLifecycle;
  sensitivity: MemorySensitivity;
  retrieval: MemoryRetrieval;
  summary: string;
  body: string;
  confidence: number;
  importance: number;
  stability: number;
  status: MemoryStatus;
  dedupeKey: string;
  sourceThreadId: string | null;
  sourceTitle: string | null;
  sourceCwd: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  reviewAt: number | null;
  expiresAt: number | null;
}

export interface RejectedJudgeDecision {
  remember: false;
  reason: "missing_summary" | "low_signal" | "secret_detected";
}

export interface AcceptedJudgeDecision {
  remember: true;
  item: MemoryItem;
}

export type JudgeDecision = RejectedJudgeDecision | AcceptedJudgeDecision;

export interface QmdSearchResult extends Record<string, unknown> {
  id?: string;
  file_path?: string;
  score?: number;
  snippet?: string;
  summary?: string;
  kind?: MemoryKind;
  lifecycle?: MemoryLifecycle;
  sensitivity?: MemorySensitivity;
  retrieval?: MemoryRetrieval;
}

export interface DaemonEndpoint {
  transport: "tcp";
  host: string;
  port: number;
}

export interface DaemonRequest<TArgs = Record<string, unknown>> {
  command: string;
  args?: TArgs;
}

export interface ContextArgs {
  cwd?: string;
  query?: string;
  limit?: number | string;
}

export interface SearchArgs extends ContextArgs {
  scope?: RequestedScope;
}

export interface CaptureArgs extends SearchArgs {
  summary: string;
  body?: string;
  kind?: MemoryKind | "";
  lifecycle?: MemoryLifecycle | "";
  sensitivity?: MemorySensitivity | "";
  retrieval?: MemoryRetrieval | "";
  threadId?: string;
  title?: string;
}

export interface ItemMutationArgs {
  id: string;
}

export interface SupersedeArgs extends ItemMutationArgs {
  by: string;
}

export type CliArgValue = string | boolean;
export type CliArgs = Record<string, CliArgValue>;
