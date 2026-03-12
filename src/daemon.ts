import net, { type AddressInfo, type Socket } from "node:net";
import { rmSync, writeFileSync } from "node:fs";
import type { CaptureArgs, ContextArgs, DaemonEndpoint, DaemonRequest, MemoryItem, QmdSearchResult, SearchArgs } from "./types.js";
import { ensureRuntimeDirs, type ResolvedConfig } from "./config.js";
import { judgeCandidate } from "./judge.js";
import { removeProjection, writeProjection } from "./projector.js";
import { QmdAdapter, type QmdSearchResponse } from "./qmd.js";
import { MemoryStore } from "./store.js";
import { now, projectIdFromCwd } from "./utils.js";

export interface SearchResponse {
  ok: true;
  source: "qmd" | "sqlite" | "sqlite_fallback" | "none";
  projectId: string | null;
  results: Array<MemoryItem | QmdSearchResult>;
  qmd?: QmdSearchResponse;
}

export interface ContextResponse {
  ok: true;
  projectId: string | null;
  global: MemoryItem[];
  project: MemoryItem[];
  related: Array<MemoryItem | QmdSearchResult>;
  relatedSource: SearchResponse["source"];
}

type DaemonResponse = Record<string, unknown> | ContextResponse | SearchResponse;

function readLimit(value: number | string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class MemoryDaemon {
  private readonly store: MemoryStore;
  private readonly qmd: QmdAdapter;
  private readonly server: net.Server;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ResolvedConfig) {
    ensureRuntimeDirs(config);
    this.store = new MemoryStore(config.dbPath);
    this.qmd = new QmdAdapter(config);
    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        this.server.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        this.server.off("error", onError);
        resolve();
      };

      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.config.port, this.config.host);
    });

    const endpoint = this.getEndpoint();
    writeFileSync(this.config.endpointPath, JSON.stringify(endpoint, null, 2), "utf8");
    writeFileSync(this.config.pidPath, `${process.pid}\n`, "utf8");
    this.bumpIdle();
  }

  async dispose(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.store.close();

    if (this.server.listening) {
      await new Promise<void>((resolve, reject) => {
        this.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  }

  private getEndpoint(): DaemonEndpoint {
    const address = this.server.address();
    const port = typeof address === "object" && address ? (address as AddressInfo).port : this.config.port;
    return {
      transport: "tcp",
      host: this.config.host,
      port
    };
  }

  private bumpIdle(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      void this.shutdown("idle_timeout");
    }, this.config.idleMs);
  }

  private async shutdown(_reason: string): Promise<void> {
    await this.dispose();
    rmSync(this.config.pidPath, { force: true });
    rmSync(this.config.endpointPath, { force: true });
    process.exit(0);
  }

  private handleConnection(socket: Socket): void {
    this.bumpIdle();
    socket.setEncoding("utf8");
    let buffer = "";

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      void Promise.all(
        lines
          .filter((line) => line.trim().length > 0)
          .map(async (line) => {
            let request: DaemonRequest;
            try {
              request = JSON.parse(line) as DaemonRequest;
            } catch {
              socket.write(`${JSON.stringify({ ok: false, error: "invalid_json" })}\n`);
              return;
            }

            const response = await this.dispatch(request);
            socket.write(`${JSON.stringify(response)}\n`);
          })
      );
    });
  }

  async dispatch(request: DaemonRequest): Promise<DaemonResponse> {
    this.bumpIdle();

    switch (request.command) {
      case "status":
        return {
          ok: true,
          pid: process.pid,
          endpointPath: this.config.endpointPath,
          dbPath: this.config.dbPath,
          idleMs: this.config.idleMs,
          host: this.getEndpoint().host,
          port: this.getEndpoint().port
        };
      case "heartbeat":
        return { ok: true, ts: now() };
      case "stop":
        setTimeout(() => {
          void this.shutdown("stop");
        }, 20);
        return { ok: true };
      case "capture":
        return this.capture((request.args || {}) as unknown as CaptureArgs);
      case "context":
        return this.context((request.args || {}) as unknown as ContextArgs);
      case "search":
        return this.search((request.args || {}) as unknown as SearchArgs);
      case "dismiss":
        return this.dismiss(String((request.args as { id?: string } | undefined)?.id || ""));
      case "promote":
        return this.promote(String((request.args as { id?: string } | undefined)?.id || ""));
      case "supersede":
        return this.supersede(
          String((request.args as { id?: string } | undefined)?.id || ""),
          String((request.args as { by?: string } | undefined)?.by || "")
        );
      default:
        return { ok: false, error: "unknown_command" };
    }
  }

  private capture(args: CaptureArgs): DaemonResponse {
    const decision = judgeCandidate(args);
    if (!decision.remember) {
      return { ok: true, skipped: true, decision };
    }

    const item = this.store.remember(decision.item);
    const filePath = writeProjection(this.config, item);
    const qmd = this.qmd.upsert({ item, filePath });

    return { ok: true, skipped: false, decision, item, projectionPath: filePath, qmd };
  }

  private context(args: ContextArgs): ContextResponse {
    const projectId = args.cwd ? projectIdFromCwd(args.cwd) : null;
    const context = this.store.listContext({ projectId, limit: readLimit(args.limit, 5) });
    const relatedArgs: SearchArgs = args.cwd
      ? { cwd: args.cwd, query: args.query || "", scope: "auto", limit: readLimit(args.limit, 5) }
      : { query: args.query || "", scope: "auto", limit: readLimit(args.limit, 5) };
    const related: SearchResponse = args.query
      ? this.search(relatedArgs)
      : { ok: true, source: "none", projectId, results: [] };

    return {
      ok: true,
      projectId,
      global: context.global,
      project: context.project,
      related: related.results,
      relatedSource: related.source
    };
  }

  private search(args: SearchArgs): SearchResponse {
    const projectId = args.cwd ? projectIdFromCwd(args.cwd) : null;
    const scope = args.scope || "auto";
    const qmdSearch = this.qmd.search({
      query: args.query || "",
      scope,
      projectId,
      limit: readLimit(args.limit, 8)
    });

    if (qmdSearch.ok && !qmdSearch.skipped && qmdSearch.results.length > 0) {
      return { ok: true, source: "qmd", projectId, results: qmdSearch.results };
    }

    const results = this.store.search({
      query: args.query || "",
      scope,
      projectId,
      limit: readLimit(args.limit, 8)
    });

    return {
      ok: true,
      source: qmdSearch.skipped ? "sqlite" : "sqlite_fallback",
      projectId,
      results,
      qmd: qmdSearch
    };
  }

  private dismiss(id: string): DaemonResponse {
    const existing = this.store.getItem(id);
    if (!existing) {
      return { ok: false, error: "not_found" };
    }

    removeProjection(this.config, existing);
    return { ok: true, item: this.store.dismiss(id, now()) };
  }

  private promote(id: string): DaemonResponse {
    const existing = this.store.getItem(id);
    if (!existing) {
      return { ok: false, error: "not_found" };
    }

    removeProjection(this.config, existing);
    const promoted: MemoryItem = {
      ...existing,
      id: `${existing.id}-global`,
      scope: "global",
      projectId: null,
      dedupeKey: `${existing.dedupeKey}-global`,
      updatedAt: now(),
      createdAt: now(),
      status: "active"
    };

    const item = this.store.promote(existing.id, promoted);
    const filePath = writeProjection(this.config, item);
    const qmd = this.qmd.upsert({ item, filePath });
    return { ok: true, item, projectionPath: filePath, qmd };
  }

  private supersede(id: string, byId: string): DaemonResponse {
    const existing = this.store.getItem(id);
    if (!existing) {
      return { ok: false, error: "not_found" };
    }

    removeProjection(this.config, existing);
    return { ok: true, item: this.store.supersede(id, byId, now()) };
  }
}
