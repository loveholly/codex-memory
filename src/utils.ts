import crypto from "node:crypto";
import path from "node:path";

export function now(): number {
  return Date.now();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function hashText(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex");
}

export function normalizeText(text: string | undefined | null): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function slugify(value: string | undefined | null): string {
  return (
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

export function projectIdFromCwd(cwd: string | undefined): string {
  const absolute = path.resolve(cwd || process.cwd());
  const base = path.basename(absolute) || "workspace";
  return `${slugify(base)}-${hashText(absolute).slice(0, 8)}`;
}

export function isoTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function shellEscape(value: string | undefined | null): string {
  return `'${String(value ?? "").replace(/'/g, `'\\''`)}'`;
}

export function expandTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    if (!(key in variables)) {
      return "";
    }

    return shellEscape(variables[key]);
  });
}

export function stableDedupeKey(input: {
  scope: string;
  projectId: string | null;
  kind: string;
  summary: string;
}): string {
  return hashText([input.scope, input.projectId || "global", input.kind, normalizeText(input.summary).toLowerCase()].join("|"));
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
