import type { JudgeDecision, MemoryCandidate, MemoryItem, MemoryKind, RequestedScope } from "./types.js";
import { clamp, hashText, normalizeText, now, projectIdFromCwd, stableDedupeKey } from "./utils.js";

const GLOBAL_HINTS: RegExp[] = [
  /以后都/u,
  /默认/u,
  /通用/u,
  /统一/u,
  /长期/u,
  /\balways\b/i,
  /\bdefault\b/i,
  /\bnever\b/i,
  /\bprefer\b/i,
  /\bglobal\b/i,
  /across repos?/i
];

const IMPORTANT_HINTS: RegExp[] = [
  /决策/u,
  /约束/u,
  /偏好/u,
  /后续/u,
  /待办/u,
  /记住/u,
  /\bdecision\b/i,
  /\bconstraint\b/i,
  /\bpreference\b/i,
  /\bfollow-up\b/i,
  /\bremember\b/i
];

const PROJECT_HINTS: RegExp[] = [
  /当前项目/u,
  /当前仓库/u,
  /本仓库/u,
  /\bthis repo\b/i,
  /\bworkflow\b/i,
  /\bplaybook\b/i,
  /\barchitecture\b/i,
  /\broute\b/i
];

export function inferKind(candidate: Pick<MemoryCandidate, "summary" | "body">): MemoryKind {
  const text = `${candidate.summary || ""}\n${candidate.body || ""}`;
  if (/偏好|默认|prefer|default/i.test(text)) {
    return "preference";
  }
  if (/约束|禁止|must|never/i.test(text)) {
    return "constraint";
  }
  if (/待办|follow-up|todo|open loop/i.test(text)) {
    return "open_loop";
  }
  if (/术语|glossary|定义/i.test(text)) {
    return "glossary";
  }
  return "decision";
}

function coerceScope(scope: RequestedScope | "" | undefined, hasCwd: boolean, globalScore: number, projectScore: number): "global" | "project" {
  if (scope === "global" || scope === "project") {
    return scope;
  }

  if (globalScore > projectScore) {
    return "global";
  }

  return hasCwd ? "project" : "global";
}

function buildMemoryItem(candidate: MemoryCandidate, scope: "global" | "project", kind: MemoryKind, signal: number, globalScore: number, projectScore: number): MemoryItem {
  const projectId = scope === "project" ? projectIdFromCwd(candidate.cwd) : null;
  const createdAt = now();
  const summary = normalizeText(candidate.summary);
  const body = normalizeText(candidate.body);
  const importance = clamp(0.35 + signal * 0.1 + (kind === "decision" ? 0.15 : 0), 0.35, 0.95);
  const stability = clamp(
    0.3 + globalScore * 0.18 + (kind === "constraint" ? 0.15 : 0) + (kind === "preference" ? 0.1 : 0),
    0.2,
    0.95
  );
  const confidence = clamp(0.55 + Math.max(globalScore, projectScore) * 0.05, 0.55, 0.95);

  return {
    id: candidate.id || hashText(`${createdAt}|${summary}|${body}|${scope}|${projectId || "global"}`),
    scope,
    projectId,
    kind,
    summary,
    body,
    confidence,
    importance,
    stability,
    status: "active",
    dedupeKey: stableDedupeKey({ scope, projectId, kind, summary }),
    sourceThreadId: candidate.threadId || null,
    sourceTitle: candidate.title || null,
    sourceCwd: candidate.cwd || null,
    tags: candidate.tags || [],
    createdAt,
    updatedAt: createdAt,
    expiresAt: null
  };
}

export function judgeCandidate(candidate: MemoryCandidate): JudgeDecision {
  const summary = normalizeText(candidate.summary);
  const body = normalizeText(candidate.body);
  const combined = `${summary}\n${body}`;

  if (!summary) {
    return { remember: false, reason: "missing_summary" };
  }

  let signal = 0;
  if (summary.length >= 12) {
    signal += 1;
  }
  if (body.length >= 40) {
    signal += 1;
  }
  if (IMPORTANT_HINTS.some((pattern) => pattern.test(combined))) {
    signal += 2;
  }
  if (candidate.kind === "open_loop") {
    signal += 2;
  }

  if (signal < 2) {
    return { remember: false, reason: "low_signal" };
  }

  const kind = candidate.kind || inferKind(candidate);
  const globalScore =
    GLOBAL_HINTS.filter((pattern) => pattern.test(combined)).length +
    (kind === "preference" || kind === "constraint" ? 1 : 0);
  const projectScore =
    PROJECT_HINTS.filter((pattern) => pattern.test(combined)).length +
    (candidate.cwd ? 1 : 0) +
    (kind === "open_loop" ? 2 : 0);
  const scope = coerceScope(candidate.scope, Boolean(candidate.cwd), globalScore, projectScore);

  return {
    remember: true,
    item: buildMemoryItem(candidate, scope, kind, signal, globalScore, projectScore)
  };
}
