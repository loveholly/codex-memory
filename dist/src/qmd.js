import { spawnSync } from "node:child_process";
import { expandTemplate } from "./utils.js";
function runTemplate(template, variables) {
    const command = expandTemplate(template, variables);
    return spawnSync("/bin/sh", ["-lc", command], { encoding: "utf8" });
}
function parseSearchResults(stdout) {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "object" && entry !== null) : [];
}
export class QmdAdapter {
    config;
    constructor(config) {
        this.config = config;
    }
    upsert(input) {
        const template = this.config.qmd.upsertTemplate;
        if (!this.config.qmd.enabled || !template) {
            return { ok: true, skipped: true, reason: "qmd_upsert_template_not_configured" };
        }
        const result = runTemplate(template, {
            id: input.item.id,
            scope: input.item.scope,
            project_id: input.item.projectId || "",
            file_path: input.filePath,
            kind: input.item.kind
        });
        if (result.status !== 0) {
            return {
                ok: false,
                skipped: false,
                stderr: result.stderr.trim(),
                stdout: result.stdout.trim()
            };
        }
        return { ok: true, skipped: false };
    }
    search(input) {
        const template = this.config.qmd.searchTemplate;
        if (!this.config.qmd.enabled || !template) {
            return { ok: true, skipped: true, results: [] };
        }
        const result = runTemplate(template, {
            query: input.query,
            scope: input.scope,
            project_id: input.projectId || "",
            limit: String(input.limit)
        });
        if (result.status !== 0) {
            return {
                ok: false,
                skipped: false,
                results: [],
                stderr: result.stderr.trim(),
                stdout: result.stdout.trim()
            };
        }
        try {
            return { ok: true, skipped: false, results: parseSearchResults(result.stdout || "[]") };
        }
        catch {
            return {
                ok: false,
                skipped: false,
                results: [],
                stderr: "qmd search did not return JSON",
                stdout: result.stdout.trim()
            };
        }
    }
}
//# sourceMappingURL=qmd.js.map