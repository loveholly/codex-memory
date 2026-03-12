import { mkdirSync } from "node:fs";
import path from "node:path";
import { createStore } from "@tobilu/qmd";
function scopeDirectory(config, scope, projectId) {
    if (scope === "global") {
        return path.join(config.projectionsDir, "global");
    }
    return path.join(config.projectionsDir, "projects", projectId || "unknown-project");
}
function collectionName(scope, projectId) {
    if (scope === "global") {
        return "global";
    }
    return `project-${projectId || "unknown-project"}`;
}
function collectionNamesForSearch(scope, projectId) {
    if (scope === "global") {
        return [collectionName("global", null)];
    }
    if (scope === "project") {
        return [collectionName("project", projectId)];
    }
    return [collectionName("global", null), collectionName("project", projectId)];
}
function summarizeBody(body, maxLength = 220) {
    const normalized = String(body || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
        return undefined;
    }
    return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}
function toSearchResult(row) {
    const snippet = summarizeBody(row.body || row.context || "");
    if (snippet) {
        return {
            id: path.basename(row.filepath, path.extname(row.filepath)),
            file_path: row.filepath,
            summary: row.title,
            snippet,
            score: row.score
        };
    }
    return {
        id: path.basename(row.filepath, path.extname(row.filepath)),
        file_path: row.filepath,
        summary: row.title,
        score: row.score
    };
}
export class QmdAdapter {
    config;
    storePromise = null;
    constructor(config) {
        this.config = config;
        mkdirSync(path.dirname(config.qmdDbPath), { recursive: true });
    }
    async getStore() {
        if (!this.storePromise) {
            this.storePromise = createStore({ dbPath: this.config.qmdDbPath });
        }
        try {
            return await this.storePromise;
        }
        catch (error) {
            this.storePromise = null;
            throw error;
        }
    }
    async close() {
        if (!this.storePromise) {
            return;
        }
        const store = await this.storePromise;
        this.storePromise = null;
        await store.close();
    }
    async ensureCollection(scope, projectId) {
        const store = await this.getStore();
        const dirPath = scopeDirectory(this.config, scope, projectId);
        const name = collectionName(scope, projectId);
        mkdirSync(dirPath, { recursive: true });
        await store.addCollection(name, { path: dirPath, pattern: "**/*.md" });
        return name;
    }
    async refreshScope(scope, projectId) {
        try {
            const store = await this.getStore();
            const name = await this.ensureCollection(scope, projectId);
            await store.update({ collections: [name] });
            return { ok: true, skipped: false };
        }
        catch (error) {
            return {
                ok: false,
                skipped: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async upsert(input) {
        void input.filePath;
        return this.refreshScope(input.item.scope, input.item.projectId);
    }
    async search(input) {
        const query = input.query.trim();
        if (!query) {
            return { ok: true, skipped: false, results: [] };
        }
        try {
            const store = await this.getStore();
            const configuredCollections = await store.listCollections();
            const configuredNames = new Set(configuredCollections.map((collection) => collection.name));
            const targetCollections = collectionNamesForSearch(input.scope, input.projectId).filter((name) => configuredNames.has(name));
            if (targetCollections.length === 0) {
                return { ok: true, skipped: false, results: [] };
            }
            let rows;
            if (targetCollections.length === 1) {
                const collection = targetCollections[0];
                rows = collection
                    ? await store.searchLex(query, {
                        collection,
                        limit: input.limit
                    })
                    : [];
            }
            else {
                const resultLimit = Math.max(input.limit * 8, 50);
                const allowed = new Set(targetCollections);
                rows = store.internal
                    .searchFTS(query, resultLimit)
                    .filter((row) => allowed.has(row.collectionName))
                    .slice(0, input.limit);
            }
            return {
                ok: true,
                skipped: false,
                results: rows.map(toSearchResult)
            };
        }
        catch (error) {
            return {
                ok: false,
                skipped: false,
                results: [],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
//# sourceMappingURL=qmd.js.map