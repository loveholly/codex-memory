import net, {} from "node:net";
import { rmSync, writeFileSync } from "node:fs";
import { ensureRuntimeDirs } from "./config.js";
import { judgeCandidate } from "./judge.js";
import { removeProjection, writeProjection } from "./projector.js";
import { QmdAdapter } from "./qmd.js";
import { MemoryStore } from "./store.js";
import { now, projectIdFromCwd } from "./utils.js";
function readLimit(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
export class MemoryDaemon {
    config;
    store;
    qmd;
    server;
    idleTimer = null;
    constructor(config) {
        this.config = config;
        ensureRuntimeDirs(config);
        this.store = new MemoryStore(config.dbPath);
        this.qmd = new QmdAdapter(config);
        this.server = net.createServer((socket) => this.handleConnection(socket));
    }
    async start() {
        await new Promise((resolve, reject) => {
            const onError = (error) => {
                this.server.off("listening", onListening);
                reject(error);
            };
            const onListening = () => {
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
    async dispose() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        this.store.close();
        if (this.server.listening) {
            await new Promise((resolve, reject) => {
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
    getEndpoint() {
        const address = this.server.address();
        const port = typeof address === "object" && address ? address.port : this.config.port;
        return {
            transport: "tcp",
            host: this.config.host,
            port
        };
    }
    bumpIdle() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        this.idleTimer = setTimeout(() => {
            void this.shutdown("idle_timeout");
        }, this.config.idleMs);
    }
    async shutdown(_reason) {
        await this.dispose();
        rmSync(this.config.pidPath, { force: true });
        rmSync(this.config.endpointPath, { force: true });
        process.exit(0);
    }
    handleConnection(socket) {
        this.bumpIdle();
        socket.setEncoding("utf8");
        let buffer = "";
        socket.on("data", (chunk) => {
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            void Promise.all(lines
                .filter((line) => line.trim().length > 0)
                .map(async (line) => {
                let request;
                try {
                    request = JSON.parse(line);
                }
                catch {
                    socket.write(`${JSON.stringify({ ok: false, error: "invalid_json" })}\n`);
                    return;
                }
                const response = await this.dispatch(request);
                socket.write(`${JSON.stringify(response)}\n`);
            }));
        });
    }
    async dispatch(request) {
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
                return this.capture((request.args || {}));
            case "context":
                return this.context((request.args || {}));
            case "search":
                return this.search((request.args || {}));
            case "dismiss":
                return this.dismiss(String(request.args?.id || ""));
            case "promote":
                return this.promote(String(request.args?.id || ""));
            case "supersede":
                return this.supersede(String(request.args?.id || ""), String(request.args?.by || ""));
            default:
                return { ok: false, error: "unknown_command" };
        }
    }
    capture(args) {
        const decision = judgeCandidate(args);
        if (!decision.remember) {
            return { ok: true, skipped: true, decision };
        }
        const item = this.store.remember(decision.item);
        const filePath = writeProjection(this.config, item);
        const qmd = this.qmd.upsert({ item, filePath });
        return { ok: true, skipped: false, decision, item, projectionPath: filePath, qmd };
    }
    context(args) {
        const projectId = args.cwd ? projectIdFromCwd(args.cwd) : null;
        const context = this.store.listContext({ projectId, limit: readLimit(args.limit, 5) });
        const relatedArgs = args.cwd
            ? { cwd: args.cwd, query: args.query || "", scope: "auto", limit: readLimit(args.limit, 5) }
            : { query: args.query || "", scope: "auto", limit: readLimit(args.limit, 5) };
        const related = args.query
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
    search(args) {
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
    dismiss(id) {
        const existing = this.store.getItem(id);
        if (!existing) {
            return { ok: false, error: "not_found" };
        }
        removeProjection(this.config, existing);
        return { ok: true, item: this.store.dismiss(id, now()) };
    }
    promote(id) {
        const existing = this.store.getItem(id);
        if (!existing) {
            return { ok: false, error: "not_found" };
        }
        removeProjection(this.config, existing);
        const promoted = {
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
    supersede(id, byId) {
        const existing = this.store.getItem(id);
        if (!existing) {
            return { ok: false, error: "not_found" };
        }
        removeProjection(this.config, existing);
        return { ok: true, item: this.store.supersede(id, byId, now()) };
    }
}
//# sourceMappingURL=daemon.js.map