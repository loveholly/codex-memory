# Architecture

## Runtime Model

- `scripts/codex-memory.ts`: TypeScript CLI entry compiled to `dist/scripts/codex-memory.js`.
- `src/daemon.ts`: lazy-start daemon on a local loopback TCP endpoint.
- `src/store.ts`: canonical SQLite store.
- `src/projector.ts`: Markdown projection writer for indexing.
- `src/qmd.ts`: pluggable qmd adapter.

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

## qmd Contract

`qmd` is optional. The adapter is configured with environment variables:

- `CODEX_MEMORY_QMD_UPSERT_TEMPLATE`
- `CODEX_MEMORY_QMD_SEARCH_TEMPLATE`

Both templates are shell commands with placeholders. Use unquoted placeholders; the adapter shell-escapes them.

Supported placeholders:

- `{id}`
- `{scope}`
- `{project_id}`
- `{file_path}`
- `{kind}`
- `{query}`
- `{limit}`

Expected `search` output: a JSON array. Each item may be either:

- a fully resolved search result object
- or an object keyed by `id`, `file_path`, `score`, and `snippet`

If qmd search is unavailable or returns no hits, the daemon falls back to SQLite substring search.
