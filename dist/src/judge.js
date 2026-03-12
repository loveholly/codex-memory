import { clamp, hashText, normalizeText, now, projectIdFromCwd, stableDedupeKey } from "./utils.js";
const DAY_MS = 24 * 60 * 60 * 1000;
const GLOBAL_HINTS = [
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
const IMPORTANT_HINTS = [
    /决策/u,
    /约束/u,
    /偏好/u,
    /后续/u,
    /待办/u,
    /记住/u,
    /规则/u,
    /流程/u,
    /\bdecision\b/i,
    /\bconstraint\b/i,
    /\bpreference\b/i,
    /\bfollow-up\b/i,
    /\bremember\b/i,
    /\bworkflow\b/i,
    /\bprocedure\b/i
];
const PROJECT_HINTS = [
    /当前项目/u,
    /当前仓库/u,
    /本仓库/u,
    /\bthis repo\b/i,
    /\bworkflow\b/i,
    /\bplaybook\b/i,
    /\barchitecture\b/i,
    /\broute\b/i
];
const SECRET_HINTS = [
    /\bapi[_ -]?key\b/i,
    /\baccess[_ -]?token\b/i,
    /\brefresh[_ -]?token\b/i,
    /\bsecret\b/i,
    /\bpassword\b/i,
    /\bpasswd\b/i,
    /private key/i,
    /begin [a-z ]*private key/i
];
const SENSITIVE_HINTS = [
    /薪资/u,
    /绩效/u,
    /面试反馈/u,
    /候选人/u,
    /个人隐私/u,
    /\bpersonal\b/i,
    /\bprivate\b/i,
    /\bconfidential\b/i,
    /\bcandidate\b/i
];
const PUBLIC_HINTS = [/公开/u, /开源/u, /\bpublic\b/i, /\boss\b/i, /open source/i];
const TIME_SENSITIVE_HINTS = [
    /今天/u,
    /本周/u,
    /本月/u,
    /临时/u,
    /截至/u,
    /目前版本/u,
    /latest/i,
    /currently/i,
    /current version/i,
    /as of/i,
    /this week/i,
    /temporary/i,
    /\bq[1-4]\b/i,
    /\b20\d{2}\b/
];
const STALE_HINTS = [/过时/u, /待确认/u, /废弃/u, /obsolete/i, /outdated/i, /deprecated/i, /stale/i];
const EXPIRED_HINTS = [/失效/u, /过期/u, /停止使用/u, /expired/i, /no longer valid/i];
function inferKind(candidate) {
    const text = `${candidate.summary || ""}\n${candidate.body || ""}`;
    if (/偏好|默认|习惯|prefer|default/i.test(text)) {
        return "preference";
    }
    if (/约束|禁止|不要|必须|must|never|guardrail/i.test(text)) {
        return "constraint";
    }
    if (/流程|步骤|runbook|playbook|workflow|how to|procedure|process/i.test(text)) {
        return "procedure";
    }
    if (/待办|后续|follow-up|todo|open loop|pending/i.test(text)) {
        return "open_loop";
    }
    if (/计划|路线图|phase|milestone|roadmap|next step|plan/i.test(text)) {
        return "plan";
    }
    if (/术语|glossary|定义|definition|means/i.test(text)) {
        return "glossary";
    }
    if (/依赖|owner|负责|关系|depends on|paired with|reports to/i.test(text)) {
        return "relationship";
    }
    if (/事实|现状|状态|currently|current state|fact|version/i.test(text)) {
        return "fact";
    }
    return "decision";
}
function inferSensitivity(candidate) {
    const text = `${candidate.summary || ""}\n${candidate.body || ""}`;
    if (SECRET_HINTS.some((pattern) => pattern.test(text))) {
        return "secret";
    }
    if (SENSITIVE_HINTS.some((pattern) => pattern.test(text))) {
        return "sensitive";
    }
    if (PUBLIC_HINTS.some((pattern) => pattern.test(text))) {
        return "public";
    }
    return "internal";
}
function baseStability(kind, globalScore, projectScore) {
    return clamp(0.3 +
        globalScore * 0.18 +
        (kind === "constraint" ? 0.15 : 0) +
        (kind === "preference" ? 0.1 : 0) +
        (kind === "procedure" ? 0.08 : 0) -
        (kind === "plan" || kind === "open_loop" ? 0.08 : 0) -
        (projectScore > globalScore ? 0.04 : 0), 0.2, 0.95);
}
function inferLifecycle(candidate, kind, stability) {
    const text = `${candidate.summary || ""}\n${candidate.body || ""}`;
    if (EXPIRED_HINTS.some((pattern) => pattern.test(text))) {
        return "expired";
    }
    if (kind === "open_loop" || kind === "plan") {
        return "review";
    }
    if (STALE_HINTS.some((pattern) => pattern.test(text))) {
        return "stale";
    }
    if (TIME_SENSITIVE_HINTS.some((pattern) => pattern.test(text))) {
        return stability >= 0.75 ? "review" : "stale";
    }
    return "active";
}
function inferRetrieval(input) {
    if (input.lifecycle === "expired") {
        return "manual";
    }
    if (input.lifecycle === "stale") {
        return "fallback";
    }
    if (input.sensitivity === "sensitive") {
        return "query";
    }
    if (input.scope === "global" && (input.kind === "preference" || input.kind === "constraint") && input.stability >= 0.6) {
        return "always";
    }
    if (input.scope === "project" && (input.kind === "decision" || input.kind === "procedure" || input.kind === "open_loop" || input.kind === "plan")) {
        return "context";
    }
    if (input.kind === "glossary" || input.kind === "fact" || input.kind === "relationship") {
        return "query";
    }
    return "context";
}
function reviewAtForLifecycle(createdAt, lifecycle, kind, sensitivity) {
    if (lifecycle === "expired") {
        return createdAt;
    }
    if (lifecycle === "stale") {
        return createdAt + 3 * DAY_MS;
    }
    if (lifecycle !== "review") {
        return null;
    }
    if (kind === "open_loop") {
        return createdAt + 7 * DAY_MS;
    }
    if (kind === "plan") {
        return createdAt + 14 * DAY_MS;
    }
    if (sensitivity === "sensitive") {
        return createdAt + 14 * DAY_MS;
    }
    return createdAt + 30 * DAY_MS;
}
function coerceScope(scope, hasCwd, globalScore, projectScore) {
    if (scope === "global" || scope === "project") {
        return scope;
    }
    if (globalScore > projectScore) {
        return "global";
    }
    return hasCwd ? "project" : "global";
}
function buildMemoryItem(candidate, scope, kind, signal, globalScore, projectScore) {
    const projectId = scope === "project" ? projectIdFromCwd(candidate.cwd) : null;
    const createdAt = now();
    const summary = normalizeText(candidate.summary);
    const body = normalizeText(candidate.body);
    const baseImportance = 0.35 + signal * 0.1 + (kind === "decision" ? 0.15 : 0) + (kind === "open_loop" || kind === "plan" ? 0.05 : 0);
    const confidence = clamp(0.55 + Math.max(globalScore, projectScore) * 0.05, 0.55, 0.95);
    const stability = candidate.lifecycle === "stale" ? 0.25 : baseStability(kind, globalScore, projectScore);
    const lifecycle = candidate.lifecycle || inferLifecycle(candidate, kind, stability);
    const sensitivity = candidate.sensitivity || inferSensitivity(candidate);
    const retrieval = candidate.retrieval || inferRetrieval({ kind, lifecycle, sensitivity, scope, stability });
    const importance = clamp(baseImportance + (retrieval === "always" ? 0.05 : 0) + (sensitivity === "sensitive" ? 0.03 : 0), 0.35, 0.95);
    return {
        id: candidate.id || hashText(`${createdAt}|${summary}|${body}|${scope}|${projectId || "global"}`),
        scope,
        projectId,
        kind,
        lifecycle,
        sensitivity,
        retrieval,
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
        reviewAt: reviewAtForLifecycle(createdAt, lifecycle, kind, sensitivity),
        expiresAt: lifecycle === "expired" ? createdAt : null
    };
}
export function judgeCandidate(candidate) {
    const summary = normalizeText(candidate.summary);
    const body = normalizeText(candidate.body);
    const combined = `${summary}\n${body}`;
    if (!summary) {
        return { remember: false, reason: "missing_summary" };
    }
    const sensitivity = candidate.sensitivity || inferSensitivity(candidate);
    if (sensitivity === "secret") {
        return { remember: false, reason: "secret_detected" };
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
    if (candidate.kind === "open_loop" || candidate.kind === "plan") {
        signal += 2;
    }
    if (candidate.kind === "procedure" || candidate.kind === "constraint") {
        signal += 1;
    }
    if (signal < 2) {
        return { remember: false, reason: "low_signal" };
    }
    const kind = candidate.kind || inferKind(candidate);
    const globalScore = GLOBAL_HINTS.filter((pattern) => pattern.test(combined)).length +
        (kind === "preference" || kind === "constraint" ? 1 : 0) +
        (kind === "fact" && !candidate.cwd ? 1 : 0);
    const projectScore = PROJECT_HINTS.filter((pattern) => pattern.test(combined)).length +
        (candidate.cwd ? 1 : 0) +
        (kind === "open_loop" || kind === "procedure" || kind === "plan" ? 2 : 0) +
        (kind === "decision" ? 1 : 0);
    const scope = coerceScope(candidate.scope, Boolean(candidate.cwd), globalScore, projectScore);
    return {
        remember: true,
        item: buildMemoryItem({ ...candidate, sensitivity }, scope, kind, signal, globalScore, projectScore)
    };
}
export { inferKind, inferLifecycle, inferRetrieval, inferSensitivity, reviewAtForLifecycle };
//# sourceMappingURL=judge.js.map