# codex-memory

`codex-memory` is a publishable Codex skill plus CLI that adds durable cross-session memory with:

- lazy-start daemon
- idle shutdown
- project/global memory scopes
- multi-dimensional memory typing across `kind`, `lifecycle`, `sensitivity`, and `retrieval`
- packaged `@tobilu/qmd` indexing and search
- TypeScript source, compiled `dist/` runtime, and tests

The real upstream qmd dependency is bundled through this package as `@tobilu/qmd`. Users do not need a separate `qmd` install, sidecar service, or manual setup.

## Install

Skill install:

```bash
npx skills add loveholly/codex-memory
```

CLI install from npm after publish:

```bash
npm install -g codex-memory
```

## Usage

Load context before substantial work:

```bash
node ~/.codex/skills/codex-memory/dist/scripts/codex-memory.js context --cwd "$PWD" --query "memory system task" --json
```

Capture durable outcomes:

```bash
node ~/.codex/skills/codex-memory/dist/scripts/codex-memory.js capture \
  --cwd "$PWD" \
  --scope auto \
  --kind decision \
  --retrieval context \
  --summary "Use packaged qmd indexing for memory search" \
  --body "Users should not install or configure qmd separately."
```

Useful capture dimensions:

- `--kind preference|decision|constraint|open_loop|glossary|fact|procedure|plan|relationship`
- `--lifecycle active|review|stale|expired`
- `--sensitivity public|internal|sensitive|secret`
- `--retrieval always|context|query|fallback|manual`

What the daemon decides automatically when you omit those flags:

- `scope`: `global` vs `project`
- `kind`: what type of durable memory this is
- `lifecycle`: whether it should stay active, be reviewed, or only be used as stale fallback
- `sensitivity`: whether it is safe for normal retrieval
- `retrieval`: always-load vs context vs query-only vs fallback-only

`secret` material is rejected instead of being persisted.

Keep the daemon warm during long sessions:

```bash
node ~/.codex/skills/codex-memory/dist/scripts/codex-memory.js daemon heartbeat
```

## Optional Backup

You can optionally back up canonical memory plus projections to a private GitHub repo through ordinary `git` push operations.

Required env vars:

```bash
export CODEX_MEMORY_BACKUP_REPO="git@github.com:you/codex-memory-backup.git"
```

Optional env vars:

```bash
export CODEX_MEMORY_BACKUP_BRANCH="main"
export CODEX_MEMORY_BACKUP_WORKTREE="$HOME/.codex/memories/codex-memory/_backup_repo"
export CODEX_MEMORY_BACKUP_AUTO_PUSH="1"
```

Manual commands:

```bash
node ~/.codex/skills/codex-memory/dist/scripts/codex-memory.js backup status
node ~/.codex/skills/codex-memory/dist/scripts/codex-memory.js backup push --reason "manual"
```

What gets backed up:

- canonical memory exported as deterministic JSON
- Markdown projections grouped by scope/project

What does not need backup:

- `qmd.db` is derived and can be rebuilt locally

## Development

```bash
npm install
npm run validate
npm run smoke
```

`npm run smoke` requires an environment that allows local loopback listeners.

## Release

This repo ships two things:

- the GitHub-hosted skill for `skills add`
- the npm package for CLI distribution

Release flow:

1. Update `package.json` version.
2. Commit and push to `main`.
3. Create and push a tag like `v0.1.0`.
4. GitHub Actions will:
   - run validation
   - publish to npm using `NPM_TOKEN`
   - create a GitHub Release

Required secrets:

- `NPM_TOKEN` for npm publish
