import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SOURCE_DIRS = ["src", "scripts", "tests"].map((segment) => path.join(REPO_ROOT, segment));
function walk(dirPath) {
    const entries = readdirSync(dirPath);
    const files = [];
    for (const entry of entries) {
        const nextPath = path.join(dirPath, entry);
        const stats = statSync(nextPath);
        if (stats.isDirectory()) {
            files.push(...walk(nextPath));
            continue;
        }
        if (nextPath.endsWith(".ts")) {
            files.push(nextPath);
        }
    }
    return files;
}
function collectLocalSpecifiers(source) {
    const specifiers = [];
    for (const match of source.matchAll(/\bfrom\s+["'](\.\.?\/[^"']+)["']/g)) {
        const specifier = match[1];
        if (specifier) {
            specifiers.push(specifier);
        }
    }
    for (const match of source.matchAll(/\bimport\s*\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g)) {
        const specifier = match[1];
        if (specifier) {
            specifiers.push(specifier);
        }
    }
    return specifiers;
}
test("source TypeScript files use extensionless local imports", () => {
    const violations = [];
    for (const dirPath of SOURCE_DIRS) {
        for (const filePath of walk(dirPath)) {
            const source = readFileSync(filePath, "utf8");
            const specifiers = collectLocalSpecifiers(source);
            for (const specifier of specifiers) {
                if (specifier.endsWith(".js") || specifier.endsWith(".ts")) {
                    violations.push(`${path.relative(REPO_ROOT, filePath)} -> ${specifier}`);
                }
            }
        }
    }
    assert.deepEqual(violations, []);
});
//# sourceMappingURL=source-imports.test.js.map