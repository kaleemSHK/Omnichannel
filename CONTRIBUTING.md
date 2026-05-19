# Contributing to BlinkOne

BlinkOne extends Chatwoot Community Edition with sidecar services for LABBIK Telecom S.P.C. This repository holds deployment configuration, sidecars, and operational tooling. A separate Chatwoot source fork may be added later for deep rebranding.

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `blinkone/main` | Production-aligned; protected; deploy only from tagged releases |
| `blinkone/develop` | Integration branch for the next release |
| `blinkone/feat/<name>` | Short-lived feature branches |

**Do not commit directly to `blinkone/main`.** Open a pull request from `blinkone/develop` or `blinkone/feat/<name>`.

## Remotes

After cloning, configure remotes:

```bash
git remote add origin <your-blinkone-repo-url>
git remote add upstream-chatwoot https://github.com/chatwoot/chatwoot.git
```

- **origin** — BlinkOne repository (this repo).
- **upstream-chatwoot** — Official Chatwoot CE (for quarterly merges when maintaining a fork, or for release/tag reference).

If you maintain a Chatwoot fork in another directory or submodule, merge `upstream-chatwoot/master` into that fork quarterly, resolve conflicts (especially lines marked `# BLINKONE:`), then promote into `blinkone/develop`.

## Quarterly upstream merge (Chatwoot fork)

1. `git fetch upstream-chatwoot`
2. Merge `upstream-chatwoot/master` into `blinkone/develop` (in the fork repo, if applicable).
3. Run tests and staging smoke test.
4. Update `docs/blinkone/UPSTREAM_BASE.md` and pin `CHATWOOT_IMAGE` in `.env`.
5. PR `blinkone/develop` → `blinkone/main`.

The weekly [upstream drift check](.github/workflows/upstream-drift-check.yml) opens a GitHub issue when upstream changes overlap files we modified.

## Pre-commit hooks

Install the license guard (blocks staging any path under `enterprise/`):

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit scripts/blinkone/*.sh
```

## Pull request checklist

- [ ] No files under `enterprise/` added or modified
- [ ] No `:latest` Docker tags introduced (use pinned tags from `UPSTREAM_BASE.md`)
- [ ] Secrets only in `.env` (never committed)
- [ ] Staging tested for infra or compose changes
- [ ] `docs/blinkone/TRD_MATRIX.md` updated if a TR requirement is addressed

## Commit message format

```
[blinkone-pN] short description

Optional body: what/why, TR-XX if applicable.
```

Example: `[blinkone-p1] pre-flight — backup scripts and staging compose`
