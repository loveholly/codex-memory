import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ResolvedConfig } from "./config.js";
import type { MemoryItem } from "./types.js";
import { isoTime } from "./utils.js";

function scopeDir(config: ResolvedConfig, item: MemoryItem): string {
  if (item.scope === "global") {
    return path.join(config.projectionsDir, "global");
  }

  return path.join(config.projectionsDir, "projects", item.projectId || "unknown-project");
}

export function projectionPathForItem(config: ResolvedConfig, item: MemoryItem): string {
  return path.join(scopeDir(config, item), `${item.id}.md`);
}

export function writeProjection(config: ResolvedConfig, item: MemoryItem): string {
  const filePath = projectionPathForItem(config, item);
  mkdirSync(path.dirname(filePath), { recursive: true });

  const lines = [
    "---",
    `id: "${item.id}"`,
    `scope: "${item.scope}"`,
    `project_id: "${item.projectId || ""}"`,
    `kind: "${item.kind}"`,
    `status: "${item.status}"`,
    `confidence: ${item.confidence.toFixed(2)}`,
    `importance: ${item.importance.toFixed(2)}`,
    `stability: ${item.stability.toFixed(2)}`,
    `updated_at: "${isoTime(item.updatedAt)}"`,
    `dedupe_key: "${item.dedupeKey}"`,
    "---",
    "",
    `# ${item.summary}`,
    "",
    item.body || "_No additional details._",
    "",
    "## Metadata",
    "",
    `- Source cwd: ${item.sourceCwd || ""}`,
    `- Source thread id: ${item.sourceThreadId || ""}`,
    `- Source title: ${item.sourceTitle || ""}`,
    `- Tags: ${item.tags.join(", ")}`
  ];

  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

export function removeProjection(config: ResolvedConfig, item: MemoryItem): void {
  rmSync(projectionPathForItem(config, item), { force: true });
}
