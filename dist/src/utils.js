import crypto from "node:crypto";
import path from "node:path";
export function now() {
    return Date.now();
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function hashText(text) {
    return crypto.createHash("sha1").update(text).digest("hex");
}
export function normalizeText(text) {
    return String(text ?? "").replace(/\s+/g, " ").trim();
}
export function slugify(value) {
    return (String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "workspace");
}
export function projectIdFromCwd(cwd) {
    const absolute = path.resolve(cwd || process.cwd());
    const base = path.basename(absolute) || "workspace";
    return `${slugify(base)}-${hashText(absolute).slice(0, 8)}`;
}
export function isoTime(timestamp) {
    return new Date(timestamp).toISOString();
}
export function shellEscape(value) {
    return `'${String(value ?? "").replace(/'/g, `'\\''`)}'`;
}
export function expandTemplate(template, variables) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
        if (!(key in variables)) {
            return "";
        }
        return shellEscape(variables[key]);
    });
}
export function stableDedupeKey(input) {
    return hashText([input.scope, input.projectId || "global", input.kind, normalizeText(input.summary).toLowerCase()].join("|"));
}
export function toJson(value) {
    return JSON.stringify(value, null, 2);
}
//# sourceMappingURL=utils.js.map