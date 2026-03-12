import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIST_ROOT = fileURLToPath(new URL("../../dist/", import.meta.url));
test("dist ships the vendored mac runtime required by qmd", () => {
    const manifestPath = path.join(DIST_ROOT, "vendor", "manifest.json");
    const qmdEntryPath = path.join(DIST_ROOT, "vendor", "node_modules", "@tobilu", "qmd", "dist", "index.js");
    const betterSqliteBinary = path.join(DIST_ROOT, "vendor", "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
    const sqliteVecPackage = path.join(DIST_ROOT, "vendor", "node_modules", "sqlite-vec-darwin-arm64", "vec0.dylib");
    assert.equal(existsSync(manifestPath), true);
    assert.equal(existsSync(qmdEntryPath), true);
    assert.equal(existsSync(betterSqliteBinary), true);
    assert.equal(existsSync(sqliteVecPackage), true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.platform, process.platform);
    assert.equal(manifest.arch, process.arch);
    assert.equal(Array.isArray(manifest.packages), true);
    assert.equal(manifest.packages?.includes("@tobilu/qmd"), true);
    assert.equal(manifest.packages?.includes("better-sqlite3"), true);
});
//# sourceMappingURL=runtime-bundle.test.js.map