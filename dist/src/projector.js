import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isoTime } from "./utils.js";
function scopeDir(config, item) {
    if (item.scope === "global") {
        return path.join(config.projectionsDir, "global");
    }
    return path.join(config.projectionsDir, "projects", item.projectId || "unknown-project");
}
export function projectionPathForItem(config, item) {
    return path.join(scopeDir(config, item), `${item.id}.md`);
}
export function writeProjection(config, item) {
    const filePath = projectionPathForItem(config, item);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const lines = [
        "---",
        `id: "${item.id}"`,
        `scope: "${item.scope}"`,
        `project_id: "${item.projectId || ""}"`,
        `kind: "${item.kind}"`,
        `lifecycle: "${item.lifecycle}"`,
        `sensitivity: "${item.sensitivity}"`,
        `retrieval: "${item.retrieval}"`,
        `status: "${item.status}"`,
        `confidence: ${item.confidence.toFixed(2)}`,
        `importance: ${item.importance.toFixed(2)}`,
        `stability: ${item.stability.toFixed(2)}`,
        `updated_at: "${isoTime(item.updatedAt)}"`,
        `review_at: "${item.reviewAt ? isoTime(item.reviewAt) : ""}"`,
        `dedupe_key: "${item.dedupeKey}"`,
        "---",
        "",
        `# ${item.summary}`,
        "",
        item.body || "_No additional details._",
        "",
        "## Metadata",
        "",
        `- Lifecycle: ${item.lifecycle}`,
        `- Retrieval: ${item.retrieval}`,
        `- Sensitivity: ${item.sensitivity}`,
        `- Source cwd: ${item.sourceCwd || ""}`,
        `- Source thread id: ${item.sourceThreadId || ""}`,
        `- Source title: ${item.sourceTitle || ""}`,
        `- Tags: ${item.tags.join(", ")}`
    ];
    writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
    return filePath;
}
export function removeProjection(config, item) {
    rmSync(projectionPathForItem(config, item), { force: true });
}
//# sourceMappingURL=projector.js.map