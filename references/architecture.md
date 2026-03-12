# Architecture

## Runtime Model

- `scripts/codex-memory.ts`: TypeScript CLI entry compiled to `dist/scripts/codex-memory.js`.
- `src/daemon.ts`: lazy-start daemon on a local loopback TCP endpoint.
- `src/store.ts`: canonical SQLite store.
- `src/projector.ts`: Markdown projection writer for indexing.
- `src/qmd.ts`: built-in qmd-compatible search index on SQLite.

## Lifecycle

1. CLI command runs.
2. CLI checks the endpoint file and local TCP listener.
3. If the daemon is absent, CLI spawns `daemon run`.
4. Every command counts as activity; `daemon heartbeat` is available for long-running work.
5. The daemon exits after `CODEX_MEMORY_IDLE_MS` of inactivity.

## Canonical Store

- Backing file: `~/.codex/memories/codex-memory/memory.db` by default.
- Memory source of truth is SQLite, not Markdown.
- Projection files are derived artifacts.

## Scope Rules

- `global`: long-lived user preferences, cross-repo constraints, reusable defaults.
- `project`: cwd-bound decisions, project architecture, open loops, local terminology.
- `drop`: low-signal or transient conversation output.

## Built-in qmd Layer

`qmd` is built into this package and does not require a separate binary, external service, or user-managed install step.

- Canonical memory remains in `memory.db`
- qmd index data lives in `qmd.db`
- Projection files are still written for auditability and skill portability
- Search flow is:
  - built-in qmd index first
  - canonical SQLite fallback second
