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
2. Run `npm run validate`.
3. Run `npm run smoke` in an environment that allows local loopback listeners.
4. Push the repo to GitHub.
5. Verify the install command against a clean Codex environment.
6. Push a version tag like `v0.1.0`.
7. Ensure `NPM_TOKEN` is configured in GitHub Actions secrets so the release workflow can publish to npm and create a GitHub Release.
