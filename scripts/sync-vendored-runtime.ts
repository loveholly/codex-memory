#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function packageDir(rootNodeModules: string, packageName: string): string {
  return path.join(rootNodeModules, ...packageName.split("/"));
}

function readManifest(rootNodeModules: string, packageName: string): PackageManifest {
  const manifestPath = path.join(packageDir(rootNodeModules, packageName), "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
}

function shouldIncludeOptional(rootNodeModules: string, packageName: string): boolean {
  return existsSync(packageDir(rootNodeModules, packageName));
}

function collectRuntimePackages(rootNodeModules: string, packageName: string, seen: Set<string>): void {
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

function copyPackage(rootNodeModules: string, vendorNodeModules: string, packageName: string): void {
  const sourceDir = packageDir(rootNodeModules, packageName);
  const targetDir = packageDir(vendorNodeModules, packageName);
  mkdirSync(path.dirname(targetDir), { recursive: true });
  cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true
  });
}

function main(): void {
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

  const packages = new Set<string>();
  collectRuntimePackages(rootNodeModules, "@tobilu/qmd", packages);

  for (const packageName of [...packages].sort()) {
    copyPackage(rootNodeModules, vendorNodeModules, packageName);
  }

  writeFileSync(
    path.join(vendorRoot, "manifest.json"),
    JSON.stringify(
      {
        platform: process.platform,
        arch: process.arch,
        packagedAt: new Date().toISOString(),
        packageCount: packages.size,
        packages: [...packages].sort()
      },
      null,
      2
    ),
    "utf8"
  );
}

main();
