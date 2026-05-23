# Developer onboarding

1. Read [ARCHITECTURE.md](../ARCHITECTURE.md) and [TRD_MATRIX.md](../TRD_MATRIX.md).
2. Install Node 20+, pnpm, Docker.
3. `cp .env.example .env` — fill tokens.
4. `docker compose up -d postgres_app redis` then build services as needed.
5. `pnpm install && pnpm build` for shared packages.
6. Run tests: `node --test tests/blinkone/*.test.js`.
7. Pick a sidecar — read its `docs/blinkone/PROMPT*.md` and `openapi.yaml`.
8. Follow [ENTERPRISE_DO_NOT_TOUCH.md](../ENTERPRISE_DO_NOT_TOUCH.md) — never import `enterprise/`.

PR checklist: license hook, tenant header on APIs, audit write for mutations.
