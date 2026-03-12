import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST_DIR = fileURLToPath(new URL("..", import.meta.url));

function walk(dirPath: string): string[] {
  const entries = readdirSync(dirPath);
  const files: string[] = [];

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

function needsJsExtension(specifier: string): boolean {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return false;
  }

  return path.posix.extname(specifier) === "";
}

function rewriteText(source: string): string {
  const rewriteSpecifier = (specifier: string): string => (needsJsExtension(specifier) ? `${specifier}.js` : specifier);

  return source
    .replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (_match, prefix: string, specifier: string, suffix: string) => {
      return `${prefix}${rewriteSpecifier(specifier)}${suffix}`;
    })
    .replace(/(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g, (_match, prefix: string, specifier: string, suffix: string) => {
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
