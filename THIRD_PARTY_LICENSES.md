# Third-party licenses (BlinkOne v1.0)

Generate a full inventory before release:

```powershell
node scripts/blinkone/generate-licenses.mjs
```

## Core stack (summary)

| Component | License | Source |
|-----------|---------|--------|
| Chatwoot CE v4.13 | MIT | https://github.com/chatwoot/chatwoot |
| Node.js runtime | MIT | nodejs.org |
| PostgreSQL | PostgreSQL License | postgresql.org |
| Redis | BSD-3 | redis.io |
| Keycloak | Apache-2.0 | keycloak.org |
| Express (sidecars) | MIT | npm |
| Vue 3 (Chatwoot dashboard) | MIT | npm |
| pnpm / workspace packages | See `pnpm licenses` | |

## Policy

- No GPL dependencies in distributed server code without legal approval.
- Run `pnpm licenses list --prod` at repo root and each `services/*/package.json` before tagging `v1.0.0`.

_Full machine-readable output: run generator script above._
