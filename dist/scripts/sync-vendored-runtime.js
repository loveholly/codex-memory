#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function packageDir(rootNodeModules, packageName) {
    return path.join(rootNodeModules, ...packageName.split("/"));
}
function readManifest(rootNodeModules, packageName) {
    const manifestPath = path.join(packageDir(rootNodeModules, packageName), "package.json");
    return JSON.parse(readFileSync(manifestPath, "utf8"));
}
function shouldIncludeOptional(rootNodeModules, packageName) {
    return existsSync(packageDir(rootNodeModules, packageName));
}
function collectRuntimePackages(rootNodeModules, packageName, seen) {
    if (seen.has(packageName) || !existsSync(packageDir(rootNodeModules, packageName))) {
        return;
    }
    seen.add(packageName);
    const manifest = readManifest(rootNodeModules, packageName);
    for (const dependencyName of Object.keys(manifest.dependencies || {})) {
        collectRuntimePackages(rootNodeModules, dependencyName, seen);
    }
    for (const dependencyName of Object.keys(manifest.optionalDependencies || {})) {
        if (shouldIncludeOptional(rootNodeModules, dependencyName)) {
            collectRuntimePackages(rootNodeModules, dependencyName, seen);
        }
    }
}
function copyPackage(rootNodeModules, vendorNodeModules, packageName) {
    const sourceDir = packageDir(rootNodeModules, packageName);
    const targetDir = packageDir(vendorNodeModules, packageName);
    mkdirSync(path.dirname(targetDir), { recursive: true });
    cpSync(sourceDir, targetDir, {
        recursive: true,
        force: true
    });
}
function main() {
    const scriptPath = fileURLToPath(import.meta.url);
    const distDir = path.resolve(path.dirname(scriptPath), "..");
    const repoRoot = path.resolve(distDir, "..");
    const rootNodeModules = path.join(repoRoot, "node_modules");
    const vendorRoot = path.join(distDir, "vendor");
    const vendorNodeModules = path.join(vendorRoot, "node_modules");
    if (!existsSync(rootNodeModules) || !statSync(rootNodeModules).isDirectory()) {
        throw new Error(`Missing root node_modules at ${rootNodeModules}`);
    }
    rmSync(vendorRoot, { recursive: true, force: true });
    mkdirSync(vendorNodeModules, { recursive: true });
    const packages = new Set();
    collectRuntimePackages(rootNodeModules, "@tobilu/qmd", packages);
    for (const packageName of [...packages].sort()) {
        copyPackage(rootNodeModules, vendorNodeModules, packageName);
    }
    writeFileSync(path.join(vendorRoot, "manifest.json"), JSON.stringify({
        platform: process.platform,
        arch: process.arch,
        packagedAt: new Date().toISOString(),
        packageCount: packages.size,
        packages: [...packages].sort()
    }, null, 2), "utf8");
}
main();
//# sourceMappingURL=sync-vendored-runtime.js.map