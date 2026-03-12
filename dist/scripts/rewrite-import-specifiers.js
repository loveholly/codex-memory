import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIST_DIR = fileURLToPath(new URL("..", import.meta.url));
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
        if (nextPath.endsWith(".js") || nextPath.endsWith(".d.ts")) {
            files.push(nextPath);
        }
    }
    return files;
}
function needsJsExtension(specifier) {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        return false;
    }
    return path.posix.extname(specifier) === "";
}
function rewriteText(source) {
    const rewriteSpecifier = (specifier) => (needsJsExtension(specifier) ? `${specifier}.js` : specifier);
    return source
        .replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (_match, prefix, specifier, suffix) => {
        return `${prefix}${rewriteSpecifier(specifier)}${suffix}`;
    })
        .replace(/(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g, (_match, prefix, specifier, suffix) => {
        return `${prefix}${rewriteSpecifier(specifier)}${suffix}`;
    });
}
for (const filePath of walk(DIST_DIR)) {
    const source = readFileSync(filePath, "utf8");
    const rewritten = rewriteText(source);
    if (rewritten !== source) {
        writeFileSync(filePath, rewritten, "utf8");
    }
}
//# sourceMappingURL=rewrite-import-specifiers.js.map