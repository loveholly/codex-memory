#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./codex-memory.js", import.meta.url));
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "codex-memory-"));
const env = {
  ...process.env,
  CODEX_MEMORY_HOME: path.join(tempRoot, "memory-home"),
  CODEX_MEMORY_RUN_DIR: path.join(tempRoot, "run"),
  CODEX_MEMORY_IDLE_MS: "5000"
};

function run(args: string[]): Record<string, unknown> {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    env,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${args.join(" ")}\n${result.stderr}`);
  }

  return JSON.parse(result.stdout || "{}") as Record<string, unknown>;
}

try {
  const backupStatus = run(["backup", "status", "--json"]);
  if (backupStatus.enabled !== false) {
    throw new Error("Backup status should default to disabled in quick-validate");
  }

  run(["daemon", "ensure", "--json"]);
  const captured = run([
    "capture",
    "--cwd",
    process.cwd(),
    "--kind",
    "decision",
    "--summary",
    "This repo should load durable memory before large implementations",
    "--body",
    "Current repo workflow: load durable memory before large implementations so follow-up work keeps the same decision context.",
    "--json"
  ]);

  if (!captured.ok || captured.skipped) {
    throw new Error("Capture did not produce a memory item");
  }

  const context = run(["context", "--cwd", process.cwd(), "--json"]);
  if (!Array.isArray(context.project) || context.project.length === 0) {
    throw new Error("Context did not return the captured project memory");
  }

  const search = run(["search", "--cwd", process.cwd(), "--query", "durable memory", "--json"]);
  if (!Array.isArray(search.results) || search.results.length === 0) {
    throw new Error("Search did not return the captured memory");
  }

  run(["daemon", "stop", "--json"]);
  console.log("quick-validate: ok");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
