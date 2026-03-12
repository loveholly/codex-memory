import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";
export function resolveConfig(env = process.env) {
    const codexHome = env.CODEX_HOME || path.join(os.homedir(), ".codex");
    const baseDir = env.CODEX_MEMORY_HOME || path.join(codexHome, "memories", "codex-memory");
    const runDir = env.CODEX_MEMORY_RUN_DIR || path.join(codexHome, "run");
    const idleMs = Number(env.CODEX_MEMORY_IDLE_MS || 300000);
    const port = Number(env.CODEX_MEMORY_PORT || 0);
    return {
        codexHome,
        baseDir,
        runDir,
        dbPath: env.CODEX_MEMORY_DB || path.join(baseDir, "memory.db"),
        qmdDbPath: env.CODEX_MEMORY_QMD_DB || path.join(baseDir, "qmd.db"),
        projectionsDir: env.CODEX_MEMORY_PROJECTIONS || path.join(baseDir, "projections"),
        host: env.CODEX_MEMORY_HOST || "127.0.0.1",
        port: Number.isFinite(port) ? port : 0,
        endpointPath: env.CODEX_MEMORY_ENDPOINT || path.join(runDir, "codex-memoryd.json"),
        pidPath: env.CODEX_MEMORY_PID || path.join(runDir, "codex-memoryd.pid"),
        idleMs: Number.isFinite(idleMs) ? idleMs : 300000
    };
}
export function ensureRuntimeDirs(config) {
    mkdirSync(config.baseDir, { recursive: true });
    mkdirSync(config.runDir, { recursive: true });
    mkdirSync(config.projectionsDir, { recursive: true });
    mkdirSync(path.join(config.projectionsDir, "global"), { recursive: true });
    mkdirSync(path.join(config.projectionsDir, "projects"), { recursive: true });
}
//# sourceMappingURL=config.js.map