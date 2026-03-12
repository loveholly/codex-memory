---
name: codex-memory
description: Durable cross-session memory workflow for Codex. Use when the user wants a system-level memory layer, wants to retrieve or persist durable decisions/preferences/open loops, or wants to operate the codex-memory CLI, daemon, or qmd indexing flow.
---

# Codex Memory

Use this skill for durable memory, not transient notes.

## Quick Start

1. Resolve the skill directory from this `SKILL.md`.
2. Run the local CLI with `node "<skill-dir>/dist/scripts/codex-memory.js" ...`.
3. Let the CLI lazily start the daemon when needed.

## Workflow

### 1) Load memory before substantial work

Run:

```bash
node "<skill-dir>/dist/scripts/codex-memory.js" context --cwd "$PWD" --query "<task summary>" --json
```

- Use `context` at the start of a thread or before a large implementation.
- Use `search` when you need a targeted lookup instead of the default context bundle.

### 2) Capture only durable outcomes

Capture only when the conversation produced something that should survive session boundaries:

- long-lived preferences
- durable decisions
- constraints and guardrails
- open loops that must be resumed later
- reusable procedures and facts

Run:

```bash
node "<skill-dir>/dist/scripts/codex-memory.js" capture \
  --cwd "$PWD" \
  --kind decision \
  --scope auto \
  --summary "<one-line durable memory>" \
  --body "<why this matters and any follow-up>"
```

- Default to `--scope auto`. The daemon will judge `global` vs `project`.
- Use `--kind preference|decision|constraint|open_loop|glossary|fact|procedure|plan|relationship` when you know the type.
- You can also override `--lifecycle`, `--sensitivity`, and `--retrieval` when the automatic judge needs a stronger hint.
- `secret` content is rejected instead of being stored.

### 3) Keep the daemon warm during long work

For long-running sessions, send a heartbeat every few minutes:

```bash
node "<skill-dir>/dist/scripts/codex-memory.js" daemon heartbeat
```

- The daemon also treats normal commands as activity.
- It exits on idle timeout automatically.

### 4) Correct bad memory explicitly

- Promote a project memory to global:

```bash
node "<skill-dir>/dist/scripts/codex-memory.js" promote --id "<memory-id>"
```

- Dismiss low-value memory:

```bash
node "<skill-dir>/dist/scripts/codex-memory.js" dismiss --id "<memory-id>"
```

- Mark a memory superseded:

```bash
node "<skill-dir>/dist/scripts/codex-memory.js" supersede --id "<old-id>" --by "<new-id>"
```

## Guardrails

- Do not capture transient debugging steps.
- Do not capture secrets, tokens, or credentials.
- Prefer one precise memory over several vague ones.
- Read [references/architecture.md](./references/architecture.md) when changing the storage, daemon, qmd contracts, or TypeScript build output.
- Read [references/publishing.md](./references/publishing.md) when packaging or publishing this skill.
