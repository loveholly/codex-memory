import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getBackupStatus, pushBackup } from "./backup";
import { resolveConfig, type ResolvedConfig } from "./config";
import { MemoryDaemon } from "./daemon";
import type { CliArgs, CliArgValue, DaemonEndpoint, DaemonRequest } from "./types";
import { projectIdFromCwd, toJson } from "./utils";

const CLI_PATH = fileURLToPath(new URL("../scripts/codex-memory.js", import.meta.url));

interface ParsedArgs {
  command: string;
  subcommand: string | undefined;
  args: CliArgs;
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] || "help";
  const needsSubcommand = command === "daemon" || command === "backup";
  const subcommand = needsSubcommand && argv[1] && !argv[1].startsWith("--") ? argv[1] : undefined;
  const startIndex = subcommand ? 2 : 1;
  const args: CliArgs = {};

  for (let index = startIndex; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return { command, subcommand, args };
}

function readStringArg(args: CliArgs, key: string, fallback = ""): string {
  const value = args[key];
  return typeof value === "string" ? value : fallback;
}

function hasFlag(args: CliArgs, key: string): boolean {
  return Boolean(args[key]);
}

function print(output: unknown, asJson: boolean): void {
  console.log(asJson ? toJson(output) : String(output));
}

function readEndpoint(config: ResolvedConfig): DaemonEndpoint | null {
  if (!existsSync(config.endpointPath)) {
    return null;
  }

  try {
    const value = JSON.parse(readFileSync(config.endpointPath, "utf8")) as Partial<DaemonEndpoint>;
    if (value.transport === "tcp" && typeof value.host === "string" && typeof value.port === "number") {
      return value as DaemonEndpoint;
    }
  } catch {
    return null;
  }

  return null;
}

function socketRequest(config: ResolvedConfig, request: DaemonRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const endpoint = readEndpoint(config);
    if (!endpoint?.port) {
      reject(new Error("daemon endpoint is unavailable"));
      return;
    }

    const client = net.createConnection(endpoint.port, endpoint.host);
    let buffer = "";

    client.on("connect", () => {
      client.write(`${JSON.stringify(request)}\n`);
    });

    client.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          resolve(JSON.parse(line) as Record<string, unknown>);
          client.end();
          return;
        } catch (error) {
          reject(error);
          client.end();
          return;
        }
      }
    });

    client.on("error", reject);
  });
}

async function canConnect(config: ResolvedConfig): Promise<boolean> {
  try {
    const response = await socketRequest(config, { command: "status" });
    return Boolean(response.ok);
  } catch {
    return false;
  }
}

async function ensureDaemon(config: ResolvedConfig): Promise<void> {
  if (await canConnect(config)) {
    return;
  }

  const child = spawn(process.execPath, [CLI_PATH, "daemon", "run"], {
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await canConnect(config)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Failed to start codex-memory daemon");
}

function formatContext(result: Record<string, unknown>): string {
  const projectId = typeof result.projectId === "string" ? result.projectId : "";
  const project = Array.isArray(result.project) ? result.project : [];
  const global = Array.isArray(result.global) ? result.global : [];
  const projectLines = project.map((item) => {
    const candidate = item as { id?: string; kind?: string; retrieval?: string; summary?: string };
    return `- [project/${candidate.kind || "memory"}/${candidate.retrieval || "context"}] ${candidate.id || ""} ${candidate.summary || ""}`;
  });
  const globalLines = global.map((item) => {
    const candidate = item as { id?: string; kind?: string; retrieval?: string; summary?: string };
    return `- [global/${candidate.kind || "memory"}/${candidate.retrieval || "context"}] ${candidate.id || ""} ${candidate.summary || ""}`;
  });
  return [`project_id=${projectId}`, ...projectLines, ...globalLines].join("\n");
}

function formatSearch(result: Record<string, unknown>): string {
  const results = Array.isArray(result.results) ? result.results : [];
  return results
    .map((item) => {
      const candidate = item as { id?: string; kind?: string; retrieval?: string; summary?: string; file_path?: string };
      return `- [${candidate.kind || "memory"}/${candidate.retrieval || "query"}] ${candidate.id || ""} ${candidate.summary || candidate.file_path || ""}`.trim();
    })
    .join("\n");
}

function formatBackupStatus(result: Record<string, unknown>): string {
  return [
    `enabled=${String(result.enabled || false)}`,
    `auto_push=${String(result.autoPush || false)}`,
    `branch=${String(result.branch || "")}`,
    `repo=${String(result.repoUrl || "")}`,
    `snapshot=${String(result.snapshotPath || "")}`
  ].join("\n");
}

function formatBackupPush(result: Record<string, unknown>): string {
  if (result.ok && result.skipped) {
    return `backup skipped ${String(result.reason || "")}`.trim();
  }

  if (result.ok) {
    return `backup pushed ${String(result.commit || "")}`.trim();
  }

  return `backup failed ${String(result.error || result.reason || "")}`.trim();
}

function maybeAutoBackup(config: ResolvedConfig, reason: string): Record<string, unknown> | null {
  if (!config.backup.enabled || !config.backup.autoPush) {
    return null;
  }

  return pushBackup(config, reason) as unknown as Record<string, unknown>;
}

export async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);
  const config = resolveConfig();
  const asJson = hasFlag(parsed.args, "json");

  if (parsed.command === "help") {
    print(
      [
        "codex-memory commands:",
        "  daemon run|ensure|status|heartbeat|stop",
        "  context --cwd <path> [--query <text>] [--json]",
        "  search --cwd <path> --query <text> [--scope auto|global|project] [--json]",
        "  capture --cwd <path> --summary <text> [--body <text>] [--kind <type>] [--scope auto|global|project]",
        "    [--lifecycle active|review|stale|expired] [--sensitivity public|internal|sensitive|secret]",
        "    [--retrieval always|context|query|fallback|manual] [--json]",
        "  promote --id <memory-id> [--json]",
        "  dismiss --id <memory-id> [--json]",
        "  supersede --id <old-id> --by <new-id> [--json]",
        "  backup status|push [--json]"
      ].join("\n"),
      false
    );
    return;
  }

  if (parsed.command === "daemon" && parsed.subcommand === "run") {
    const daemon = new MemoryDaemon(config);
    await daemon.start();
    return new Promise(() => {});
  }

  if (parsed.command === "daemon" && parsed.subcommand === "ensure") {
    await ensureDaemon(config);
    const endpoint = readEndpoint(config);
    print(asJson ? { ok: true, endpoint } : `daemon ready tcp=${endpoint?.host || "127.0.0.1"}:${endpoint?.port || ""}`, asJson);
    return;
  }

  if (parsed.command === "daemon" && parsed.subcommand === "status") {
    if (!(await canConnect(config))) {
      print({ ok: false, running: false }, asJson);
      return;
    }

    const result = await socketRequest(config, { command: "status" });
    print(asJson ? result : `running pid=${String(result.pid || "")} tcp=${String(result.host || "")}:${String(result.port || "")}`, asJson);
    return;
  }

  if (parsed.command === "daemon" && parsed.subcommand === "heartbeat") {
    await ensureDaemon(config);
    const result = await socketRequest(config, { command: "heartbeat" });
    print(asJson ? result : `heartbeat ts=${String(result.ts || "")}`, asJson);
    return;
  }

  if (parsed.command === "daemon" && parsed.subcommand === "stop") {
    if (!existsSync(config.endpointPath)) {
      print({ ok: true, running: false }, asJson);
      return;
    }

    const result = await socketRequest(config, { command: "stop" });
    print(asJson ? result : "daemon stopping", asJson);
    return;
  }

  if (parsed.command === "backup" && parsed.subcommand === "status") {
    const result = getBackupStatus(config) as unknown as Record<string, unknown>;
    print(asJson ? result : formatBackupStatus(result), asJson);
    return;
  }

  if (parsed.command === "backup" && parsed.subcommand === "push") {
    const result = pushBackup(config, readStringArg(parsed.args, "reason", "manual")) as unknown as Record<string, unknown>;
    print(asJson ? result : formatBackupPush(result), asJson);
    return;
  }

  if (parsed.command === "backup") {
    throw new Error(`Unknown backup subcommand: ${parsed.subcommand || ""}`.trim());
  }

  await ensureDaemon(config);

  if (parsed.command === "context") {
    const result = await socketRequest(config, {
      command: "context",
      args: {
        cwd: readStringArg(parsed.args, "cwd", process.cwd()),
        query: readStringArg(parsed.args, "query"),
        limit: readStringArg(parsed.args, "limit", "5")
      }
    });
    print(asJson ? result : formatContext(result), asJson);
    return;
  }

  if (parsed.command === "search") {
    const result = await socketRequest(config, {
      command: "search",
      args: {
        cwd: readStringArg(parsed.args, "cwd", process.cwd()),
        query: readStringArg(parsed.args, "query"),
        scope: readStringArg(parsed.args, "scope", "auto"),
        limit: readStringArg(parsed.args, "limit", "8")
      }
    });
    print(asJson ? result : formatSearch(result), asJson);
    return;
  }

  if (parsed.command === "capture") {
    const cwd = readStringArg(parsed.args, "cwd", process.cwd());
    const result = await socketRequest(config, {
      command: "capture",
      args: {
        cwd,
        summary: readStringArg(parsed.args, "summary"),
        body: readStringArg(parsed.args, "body"),
        kind: readStringArg(parsed.args, "kind"),
        lifecycle: readStringArg(parsed.args, "lifecycle"),
        sensitivity: readStringArg(parsed.args, "sensitivity"),
        retrieval: readStringArg(parsed.args, "retrieval"),
        scope: readStringArg(parsed.args, "scope", "auto"),
        threadId: readStringArg(parsed.args, "threadId"),
        title: readStringArg(parsed.args, "title", path.basename(cwd)),
        projectId: projectIdFromCwd(cwd)
      }
    });
    const backup = !result.skipped && result.ok ? maybeAutoBackup(config, "capture") : null;
    if (asJson) {
      print(backup ? { ...result, backup } : result, true);
    } else {
      const message = result.skipped ? `skipped ${String((result.decision as { reason?: string } | undefined)?.reason || "")}` : `captured ${String((result.item as { id?: string } | undefined)?.id || "")}`;
      print(backup ? `${message}\n${formatBackupPush(backup)}` : message, false);
    }
    return;
  }

  if (parsed.command === "promote") {
    const result = await socketRequest(config, { command: "promote", args: { id: readStringArg(parsed.args, "id") } });
    const backup = result.ok ? maybeAutoBackup(config, "promote") : null;
    if (asJson) {
      print(backup ? { ...result, backup } : result, true);
    } else {
      const message = `promoted ${String((result.item as { id?: string } | undefined)?.id || "")}`;
      print(backup ? `${message}\n${formatBackupPush(backup)}` : message, false);
    }
    return;
  }

  if (parsed.command === "dismiss") {
    const id = readStringArg(parsed.args, "id");
    const result = await socketRequest(config, { command: "dismiss", args: { id } });
    const backup = result.ok ? maybeAutoBackup(config, "dismiss") : null;
    if (asJson) {
      print(backup ? { ...result, backup } : result, true);
    } else {
      const message = `dismissed ${id}`;
      print(backup ? `${message}\n${formatBackupPush(backup)}` : message, false);
    }
    return;
  }

  if (parsed.command === "supersede") {
    const result = await socketRequest(config, {
      command: "supersede",
      args: {
        id: readStringArg(parsed.args, "id"),
        by: readStringArg(parsed.args, "by")
      }
    });
    const backup = result.ok ? maybeAutoBackup(config, "supersede") : null;
    if (asJson) {
      print(backup ? { ...result, backup } : result, true);
    } else {
      const message = `superseded ${readStringArg(parsed.args, "id")}`;
      print(backup ? `${message}\n${formatBackupPush(backup)}` : message, false);
    }
    return;
  }

  throw new Error(`Unknown command: ${parsed.command}`);
}
