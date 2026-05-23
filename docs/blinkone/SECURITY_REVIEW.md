# Security review checklist (Prompt 11)

**Review date:** _TBD_ · **Reviewer:** _TBD_ · **Release:** v1.0

## Automated scans

| Check | Command | Status |
|-------|---------|--------|
| pnpm audit (root) | `pnpm audit` | ☐ |
| Sidecar npm audit | `node scripts/blinkone/security-audit.mjs` | ☐ |
| Trivy images | `trivy image blinkone/chatwoot:…` (each service) | ☐ |
| OWASP ZAP baseline | `zap-baseline.py -t $FRONTEND_URL` | ☐ |
| truffleHog git history | `trufflehog git file://.` | ☐ |
| Enterprise blocklist | `scripts/blinkone/precommit-license-check.sh` | ☐ |

## Manual checklist

### Authentication & authorization

- [ ] Every sidecar `/v1/*` route uses bearer token or documented public webhook with signature
- [ ] Gateway enforces JWT + `@blinkone/rbac` permissions per route prefix
- [ ] Platform routes require `X-Blinkone-Platform-Role`
- [ ] Chatwoot webhooks: HMAC `x-chatwoot-signature` when secret set

### Tenant isolation

- [ ] Postgres RLS enabled on tenant tables (see `PROMPT8_RLS_REVIEW.md`)
- [ ] Weekly run: `RUN_GAUNTLET=1 node --test tests/blinkone/cross-tenant-gauntlet.test.js`
- [ ] Redis keys use `t:{tenantId}:` prefix

### Data protection

- [ ] MinIO recordings: SSE or app-layer encryption (TR-55) — verify `RUN_ENCRYPTION_TEST=1`
- [ ] No presigned URLs with excessive TTL
- [ ] Secrets only in `.env` / vault — not in git

### Code safety

- [ ] No `eval` / `new Function` in sidecars (grep periodically)
- [ ] SQL via parameterized queries only (no string concat)
- [ ] No `enterprise/` paths in build (pre-commit hook)

### Network

- [ ] mTLS hooks documented for inter-service (production overlay)
- [ ] CORS: gateway + Chatwoot `FRONTEND_URL` only
- [ ] Rate limits on gateway (configure in nginx / WAF for production)

### Audit

- [ ] `blinkone_audit_events` append-only trigger active
- [ ] Integration `GET /v1/audit` tenant-scoped

## Findings log

| ID | Severity | Finding | Remediation | Status |
|----|----------|---------|-------------|--------|
| — | — | _None filed_ | — | — |
