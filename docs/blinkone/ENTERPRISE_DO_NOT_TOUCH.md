# Enterprise directory — DO NOT TOUCH

Generated: 2026-05-20 (initial skeleton — run `scripts/blinkone/audit-enterprise-blocklist.sh` to refresh)

The `enterprise/` tree is licensed under the **Chatwoot Enterprise License**. Do not read, copy, port, rebrand, or commit changes under this path.

Rebuild TRD features in BlinkOne sidecars or MIT-licensed `app/blinkone/` modules instead.

## This repository

_No `enterprise/` directory present._ This deploy repo uses the official CE Docker image. When you add a Chatwoot source fork, set `CHATWOOT_FORK_DIR` and re-run the audit script.

## Blocked paths (pattern)

Any path matching:

```
enterprise/**
```

The pre-commit hook enforces this on every commit when `core.hooksPath` is set to `.githooks`.
