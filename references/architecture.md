# Architecture

## Runtime Model

- `scripts/codex-memory.ts`: TypeScript CLI entry compiled to `dist/scripts/codex-memory.js`.
- `src/daemon.ts`: lazy-start daemon on a local loopback TCP endpoint.
- `src/store.ts`: canonical SQLite store.
- `src/projector.ts`: Markdown projection writer for indexing.
- `src/qmd.ts`: adapter around the upstream `@tobilu/qmd` store.

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

## Memory Ontology

Every persisted memory now carries four semantic layers:

- `kind`: `preference`, `decision`, `constraint`, `open_loop`, `glossary`, `fact`, `procedure`, `plan`, `relationship`
- `lifecycle`: `active`, `review`, `stale`, `expired`
- `sensitivity`: `public`, `internal`, `sensitive`, `secret`
- `retrieval`: `always`, `context`, `query`, `fallback`, `manual`

Operational notes:

- `secret` candidates are rejected instead of being stored.
- `always` and `context` memories are eligible for default context loading.
- `query` memories stay out of the default context bundle but remain searchable.
- `fallback` memories are only returned after primary qmd retrieval produces no acceptable hit.
- `manual` memories stay in the canonical store and backups, but are not auto-loaded or auto-searched.
- `expired` memories remain in SQLite for audit/history, but are excluded from automatic retrieval.

## Built-in qmd Layer

`qmd` is provided by the real upstream `@tobilu/qmd` dependency and is installed transitively with this package. Users do not need a separate `qmd` binary, external service, or manual install step.

- Canonical memory remains in `memory.db`
- qmd index data lives in `qmd.db`
- Projection files are still written for auditability and skill portability
- Search flow is:
  - packaged qmd FTS index first
  - canonical SQLite fallback second

## Backup Layer

Backup is optional and disabled by default.

- Canonical export comes from `memory.db` via JSON serialization, not by copying live SQLite WAL files
- Projection files are copied into the backup snapshot
- `qmd.db` is not part of the backup contract because it is derived
- The backup target is a git worktree connected to a user-provided private repo
- Manual flow: `backup push`
- Optional auto flow: set `CODEX_MEMORY_BACKUP_AUTO_PUSH=1` so mutating CLI commands push after success
