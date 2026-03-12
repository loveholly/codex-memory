# Publishing

## Repo Shape

This repo is intentionally structured so the repo root is the skill root:

- `SKILL.md`
- `agents/openai.yaml`
- `scripts/`
- `references/`

That means the standard installation target is the repo itself.

## Install Syntax

For standard `skills.sh` flows, install from GitHub using the repo path, for example:

```bash
npx skills add <owner>/codex-memory
```

or, if the installer requires an explicit skill selector in your environment:

```bash
npx skills add <owner>/codex-memory@codex-memory
```

Bare `npx skills add codex-memory` is not guaranteed by the standard GitHub install flow. That syntax depends on the installer supporting a repo alias or registry lookup outside the basic `owner/repo` contract.

## Release Checklist

1. Run `node scripts/quick-validate.js`.
1. Run `npm run validate`.
2. Run `npm run smoke` in an environment that allows local loopback listeners.
3. Push the repo to GitHub.
4. Verify the install command against a clean Codex environment.
5. If you later publish this package to npm for convenience, keep the repo-root skill layout unchanged so `skills add` continues to work.
