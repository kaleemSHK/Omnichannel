# BlinkOne — Cursor AI Prompt Pack

**Project:** Rebrand Chatwoot Community Edition to "BlinkOne" + close LABBIK TRD gaps
**Deployment:** Docker, self-hosted (on-prem)
**Current state:** Chatwoot already running in production with existing config/data
**Owner:** LABBIK Telecom S.P.C — Muscat, Oman

---

## ⚠️ Read this first — License boundary (NON-NEGOTIABLE)

Chatwoot has TWO licenses in one repo:

| Folder | License | Can you modify & resell? |
|---|---|---|
| Root code (Rails app, Vue dashboard, widget) | **MIT** | ✅ Yes — fork, rebrand, resell freely |
| `enterprise/` directory | **Chatwoot Enterprise License** | ❌ No — do not copy, port, or rebrand this code |

Chatwoot's docs explicitly say rebranding-and-reselling the Enterprise edition is forbidden. So:

**For every Chatwoot Enterprise feature LABBIK needs, we BUILD IT FRESH as a sidecar.**

| Chatwoot Enterprise feature | BlinkOne equivalent | TRD requirement it satisfies |
|---|---|---|
| SLA policies | `services/sla/` sidecar (Prompt 6) | TR-23 |
| Custom Branding admin UI | Brand-token system (Prompt 2) | TR-39 |
| Captain AI | `services/ai/` sidecar (Prompt 7) | TR-29 to TR-36 |
| SSO / SAML | Keycloak + integration sidecar (Prompt 10) | TR-49 |
| Audit Logs | Built into every sidecar (Prompt 4 onward) | TR-57 |
| Roles & Permissions | Gateway RBAC (Prompt 4) | TR-56 |
| Agent capacity | Routing sidecar (Prompt 5) | TR-13/14 |

This is enforced by `.cursorrules` (Prompt 0) and a pre-commit hook (Prompt 1).

---

## How to use this pack

You're going to run **11 prompt sessions** in Cursor, in this order. Each is a fresh Composer chat. Don't dump them all at once — Cursor produces shallow code when overloaded.

| # | Prompt | What it produces |
|---|---|---|
| 0 | `.cursorrules` setup | The always-on system prompt for every Cursor chat |
| 1 | Pre-flight & safety | Branch strategy, backups, staging env, fork hygiene |
| 2 | Brand token system | Single source of truth for BlinkOne colors/name/logo |
| 3 | Full rebrand pass | Logos, favicons, email templates, strings, widget |
| 4 | Sidecar architecture | Docker network + service skeleton for TRD gaps |
| 5 | Telephony sidecar | Asterisk + Kamailio + ACD (TR-06, 12–18) |
| 6 | SLA + Escalation sidecar | TR-23, TR-24 — Enterprise feature replacement |
| 7 | AI sidecar | Voice bot (Arabic), GPT assist, STT, RAG (TR-29–36) |
| 8 | Multi-tenant + white-label | TR-37–41 — per-client branding from one install |
| 9 | Billing sidecar | Subscriptions, usage metering (TR-42–45) |
| 10 | Integration sidecar | SSO/AD, ERP, webhooks, audit (TR-46–50, TR-57) |
| 11 | Verification & handover | Test gauntlet, docs, training, acceptance |

---

# PROMPT 0 — `.cursorrules` (paste into repo root)

Save this as `.cursorrules` at the root of your forked Chatwoot repo.

```text
You are a senior staff engineer working inside a forked Chatwoot Community Edition codebase. The fork is being rebranded to "BlinkOne" and extended with new sidecar services for LABBIK Telecom S.P.C (Muscat, Oman). You are NOT working on the upstream Chatwoot project. You are working on BlinkOne.

# Codebase facts (do not guess these)

- Chatwoot is Ruby on Rails 7 + Vue 3 + Vite, PostgreSQL, Redis, Sidekiq.
- The Rails app lives at the repo root. The dashboard SPA is at `app/javascript/dashboard/`. The customer widget is at `app/javascript/widget/`. The portal (help center) is at `app/javascript/portal/`.
- Email templates: `app/views/mailers/`.
- Brand assets: `public/`, `app/javascript/dashboard/assets/images/`, `app/javascript/widget/assets/`.
- Installation config seeds: `config/installation_config.yml`.
- The `enterprise/` directory is licensed under Chatwoot's Enterprise License. NEVER read from it, copy from it, port code from it, or work around its license checks. If a feature lives only in `enterprise/`, we BUILD IT FRESH in a sidecar or in a new MIT-licensed module under `app/blinkone/`.

# Hard rules

1. **License safety.** Never touch `enterprise/`. Never remove or bypass `ChatwootHub`, `Internal::ChatwootHubJob`, or `enterprise/` feature gates. If a TRD requirement maps to a paid Chatwoot feature, build it fresh outside core. A pre-commit hook blocks any commit that stages a file under `enterprise/` — do not try to circumvent it.

2. **Production safety.** This codebase mirrors a live production deployment with real customer data. You are working on the `blinkone/main` branch. NEVER:
   - Write destructive migrations (DROP TABLE, DROP COLUMN, data DELETE without WHERE).
   - Modify existing Chatwoot migration files. Always add NEW migrations.
   - Rename existing columns; add new columns and write a backfill script.
   - Change Sidekiq queue names without an ADR.
   - Modify the `installation_id` mechanism.

3. **Upgrade safety.** We must merge upstream Chatwoot releases quarterly. To survive merges:
   - All BlinkOne code lives under `blinkone_`-prefixed paths: `app/javascript/dashboard/blinkone_components/`, `app/services/blinkone/`, `app/controllers/blinkone/`, `config/blinkone/`, `lib/blinkone/`, `db/blinkone_migrations/` (or standard migrations with `Blinkone` prefix in class names).
   - Brand references go through `BlinkOne::Branding` (Ruby) and `useBrand()` (Vue) — never hardcoded.
   - Avoid editing Chatwoot core files. If you MUST, leave a `# BLINKONE: <reason>` comment so merges flag it.
   - New routes go under `/blinkone/` namespace.
   - New tables are prefixed `blinkone_`.

4. **Sidecar-first architecture.** TRD gaps are filled by NEW microservices that talk to Chatwoot via its REST API + webhooks. Sidecars live in `services/` (NEW top-level directory) and run as separate Docker containers. They NEVER share Chatwoot's database — each has its own Postgres schema in a separate Postgres instance.

5. **Stack lock-in.** Sidecars are **NestJS + TypeScript + Fastify adapter**. Database: **PostgreSQL 16** with **pgvector**. Cache/bus: **Redis 7**. Telephony: **Asterisk 20** behind **Kamailio**. Object storage: **MinIO**. IdP: **Keycloak**.

6. **Tenant context.** Each Chatwoot Account = one BlinkOne tenant. Every sidecar API request carries a JWT (issued by gateway) with `tenant_id` (= chatwoot_account_id), `user_id`, `roles[]`. Every sidecar row has `tenant_id NOT NULL`. Every query filters by tenant_id. Every bus event includes tenant_id. A tenant of A must never read data of B — defense in depth at gateway AND service.

7. **Event bus envelope (mandatory).**
   ```
   {
     "event_id": "uuid",
     "event_type": "string",
     "event_version": "1",
     "tenant_id": "uuid",
     "correlation_id": "uuid",
     "causation_id": "uuid|null",
     "idempotency_key": "string",
     "occurred_at": "ISO-8601",
     "producer": "service-name",
     "data": { ... }
   }
   ```
   Consumers MUST be idempotent on `idempotency_key`.

8. **Observability.** Every sidecar exposes `/healthz`, `/readyz`, `/metrics` (Prometheus). Structured JSON logs (pino) with `tenant_id` and `correlation_id`. OpenTelemetry traces to OTLP.

9. **Security defaults.** Inter-service mTLS hooks present (wire in prod). Secrets via env in dev, Vault refs in prod. Never log secrets, JWTs, or unredacted PII. Recordings and uploads encrypted at rest with per-tenant keys. RBAC enforced at gateway AND service.

10. **No placeholders.** Never write `// TODO` for security-critical code (authn, authz, tenant filter, payments, call recordings, PII). Never reference fake URLs. Use env vars.

# Working style

- When asked to build a sidecar, FIRST write the OpenAPI 3.1 spec and Prisma schema. Show them. Wait for review. THEN write handlers.
- When touching Chatwoot core, FIRST show a diff plan. Wait for review.
- Never touch more than 8 files in one turn without stopping for review.
- If ambiguous, ask ONE sharp question instead of guessing.
- Every Ruby/Vue change to core must carry the `# BLINKONE:` marker.

# Brand: BlinkOne

- Product name: "BlinkOne" (one word, capital B, capital O).
- Company: "LABBIK Telecom S.P.C" (confirm if uncertain).
- Primary color default: `#0B5FFF`. Ink default: `#0A0F1C`. Confirm before assuming.
- Always reference brand via `BlinkOne::Branding.product_name` / `useBrand().productName`. Never hardcode.
- Arabic + English support, RTL must render correctly.
```

---

# PROMPT 1 — Pre-flight & safety setup

```text
We are preparing to rebrand a live production Chatwoot Community Edition install to "BlinkOne" and bolt on sidecar services. The production stack is Docker-based and serves real customers. Before we change a single byte of code, we set up branch hygiene, backups, a staging environment, and an upstream-merge strategy.

# Deliverables

1. **Git branch strategy.**
   - Create branch `blinkone/main` off the current pinned Chatwoot release tag.
   - Create `blinkone/develop` off `blinkone/main`.
   - Add `upstream-chatwoot` remote → `https://github.com/chatwoot/chatwoot`.
   - Write `CONTRIBUTING.md`: no direct commits to `blinkone/main`; PRs from `blinkone/develop` or `blinkone/feat/<name>`; quarterly merge `upstream-chatwoot/master` into `blinkone/develop`, resolve conflicts (especially files marked `# BLINKONE:`), then promote.
   - Add `.github/workflows/upstream-drift-check.yml` running weekly, opening an issue listing every file where upstream changed and we also touched it.

2. **Production backup script.**
   - `scripts/blinkone/backup-production.sh`:
     - `pg_dump` the Chatwoot DB, timestamped, gzipped.
     - Tar `/data/storage` (Active Storage uploads).
     - Encrypt `.env.production` with `age` (prompt me to confirm tool choice).
     - Upload to S3-compatible bucket (env var `BLINKONE_BACKUP_BUCKET`).
   - `scripts/blinkone/restore-production.sh` — takes a timestamp, restores to a target environment.
   - Both idempotent, safe during business hours (`pg_dump`, not `pg_dumpall`).

3. **Staging environment.**
   - `docker-compose.staging.yml` — identical Chatwoot stack on different ports/DB/volume. Same image tag as prod.
   - `scripts/blinkone/clone-prod-to-staging.sh` — restores a prod backup into staging. PII redaction flag `--redact` that deterministically hashes contact names, emails, phone numbers, message bodies.
   - `docs/blinkone/staging.md` documenting setup.

4. **Pin the Chatwoot version.**
   - Read `.ruby-version`, `Gemfile.lock`, `package.json`, `Dockerfile` to determine the exact forked version. Record in `docs/blinkone/UPSTREAM_BASE.md` with commit SHA, release tag, date forked, link to upstream changelog at that point.
   - Pin Docker base image tags explicitly. No `:latest`.

5. **License audit.**
   - Script listing every file under `enterprise/` written to `docs/blinkone/ENTERPRISE_DO_NOT_TOUCH.md`. This is the blocklist.
   - Pre-commit hook (`scripts/blinkone/precommit-license-check.sh`) failing commits that stage any file under `enterprise/`. Wire it into Husky or equivalent.

6. **TRD traceability matrix.**
   - `docs/blinkone/TRD_MATRIX.md` — table mapping every TR-XX requirement from the LABBIK TRD to one of: `core-chatwoot` (already covered), `core-modification` (we tweak Chatwoot core with `# BLINKONE:` marker), `sidecar-<name>` (new service), or `out-of-scope`. Mark every row "PENDING DESIGN" — we fill it in as we build.

# Order of work

1. Git branches + remotes + workflow file (commit and push)
2. Backup + restore scripts (test against a docker volume)
3. Staging compose + clone script
4. Version pinning + upstream base doc
5. License audit script + pre-commit hook
6. TRD matrix skeleton

Do NOT modify application code this session. Goal is operational safety. Show me the file list before creating files, then proceed step by step.
```

---

# PROMPT 2 — Brand token system

```text
Before rebranding anything visually, we build a single source of truth for the BlinkOne brand. Every logo path, color, product name, and email "from" address flows from this — so when LABBIK adjusts a shade of blue in six months, it's a one-line change, not a 300-file grep-and-replace.

First, confirm with me:
- Primary color (default `#0B5FFF`)
- Secondary color (default `#0A0F1C`)
- Logo files — SVG + PNG ready? If not, generate placeholder SVGs (stylized "B1" wordmark) at sizes 32, 64, 128, 256, 512.
- Email "from" name and address.
- Support URL, marketing URL, terms URL, privacy URL.
- Default tagline.

Then build:

# 1. Ruby module — `lib/blinkone/branding.rb`

`BlinkOne::Branding` exposing:
```ruby
BlinkOne::Branding.product_name        # => "BlinkOne"
BlinkOne::Branding.company_name        # => "LABBIK Telecom S.P.C"
BlinkOne::Branding.primary_color       # => "#0B5FFF"
BlinkOne::Branding.logo_url(:full)
BlinkOne::Branding.logo_url(:mark)
BlinkOne::Branding.logo_url(:email)
BlinkOne::Branding.favicon_url
BlinkOne::Branding.email_from
BlinkOne::Branding.support_url
BlinkOne::Branding.terms_url
BlinkOne::Branding.privacy_url
BlinkOne::Branding.copyright_line
BlinkOne::Branding.for_tenant(account_id) # returns tenant-overridden values
```
Loads from `config/blinkone/branding.yml` (NOT installation_config.yml — kept separate so upstream merges don't fight us). YAML supports per-tenant override keyed by chatwoot_account_id.

Initializer `config/initializers/blinkone_branding.rb` loads it.

# 2. Vue composable — `app/javascript/shared/blinkone/useBrand.js`

`useBrand()` returns the same fields, fetched from `/blinkone/api/v1/branding` (cached, account-scoped). Pinia store `blinkoneBrandStore` loads once per session, refreshes on admin change.

# 3. Tailwind / SCSS integration

- `app/javascript/dashboard/assets/scss/_variables.scss` — change values to reference CSS custom properties (`--blinkone-primary`, `--blinkone-ink`, ...). Keep Chatwoot variable NAMES so upstream merges don't explode. Mark with `# BLINKONE:` comment.
- New file `app/javascript/dashboard/assets/scss/_blinkone-tokens.scss` defining the CSS vars. Imported first.
- `tailwind.config.js`: add a `blinkone` color palette referencing the CSS vars. Don't replace Chatwoot's existing colors; add alongside.

# 4. Brand asset directory — `public/blinkone-brand/`

- `logo-full.svg`, `logo-full-dark.svg`
- `logo-mark.svg`, `logo-mark-dark.svg`
- `logo-email.png` (600px wide, transparent)
- `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180px)
- `og-image.png` (1200×630)
- `splash.svg` (loading screen)
- `README.md` explaining each asset's use.

Placeholder SVGs if no real assets — simple "B1" mark with a `<!-- BLINKONE PLACEHOLDER -->` comment.

# 5. Admin endpoint

`Blinkone::Api::V1::BrandingController` mounted at `/blinkone/api/v1/branding`:
- `GET /` — current account's effective branding (public-safe fields only).
- `PATCH /` — admin-only, updates per-tenant override.
- `POST /assets` — admin-only, uploads a logo (Active Storage, account-scoped).

Policy class `Blinkone::BrandingPolicy` — only admins of the current account can mutate.

# 6. Tests

- RSpec for `BlinkOne::Branding` (defaults + tenant override + edge cases).
- RSpec for the controller (auth, tenant isolation, asset upload, file-size limits).
- Vitest for `useBrand()` against mocked endpoint.

# Order

1. Confirm brand inputs with me.
2. `branding.yml` + Ruby module + initializer + specs.
3. Brand asset directory with placeholders.
4. CSS vars + Tailwind palette.
5. Vue composable + Pinia store.
6. Admin endpoint + policy + specs.
7. Wire dashboard's existing logo references to `useBrand().logoUrl('full')`. List every file changed.

Do not start step 7 until I approve steps 1–6.
```

---

# PROMPT 3 — Full rebrand pass

```text
Brand token system is in place. Now we replace every visible "Chatwoot" reference with BlinkOne. We do this in passes, not all at once — Chatwoot has 1,200+ "Chatwoot" string occurrences across views, components, mailers, manifest, OG tags, i18n files, and seeds.

# Discovery pass — run first, do not modify code

Search the codebase and produce `docs/blinkone/REBRAND_INVENTORY.md` with categorized findings:

1. **Visible UI strings** — grep "Chatwoot" in `app/javascript/dashboard/i18n/`, `app/javascript/widget/i18n/`, `app/javascript/portal/i18n/`. Group by locale.
2. **Email template strings** — `app/views/mailers/`, `app/views/devise/`.
3. **HTML metadata** — title tags, OG tags, manifest.json, browserconfig.xml in `public/`.
4. **Logo/image references** — every `<img src=`, `background-image`, `require('...')` resolving to a Chatwoot logo.
5. **Favicons** — `public/favicon.ico`, `apple-touch-icon.png`, etc.
6. **Loading screen** — `public/index.html`, `app/views/layouts/application.html.erb`.
7. **Marketing redirects** — links to chatwoot.com, chatwoot.help, twitter/x.com/chatwoot.
8. **Seeded config** — `config/installation_config.yml` (BRAND_NAME, BRAND_URL, WIDGET_BRAND_URL, LOGO, LOGO_THUMBNAIL, FAVICON, INSTALLATION_NAME, MAILER_SENDER_EMAIL).
9. **In-app documentation links** — "Help" buttons, error pages, empty states.
10. **Widget** — `app/javascript/widget/` strings + the "Powered by" badge.

Each row: `file path | line | current string | proposed BlinkOne replacement | notes`. No edits in this pass.

# Replacement strategy — present for approval

Propose a 4-wave plan:

- **Wave A — Low-risk infrastructure strings:** installation_config.yml, manifest.json, browserconfig.xml, application.html.erb title.
- **Wave B — Visual assets:** swap favicons, splash, logos via brand tokens.
- **Wave C — i18n strings:** override Chatwoot's English strings via `blinkone_overrides.json` per locale, merged AFTER Chatwoot's i18n loader. Do NOT edit `en.json` directly. Build that loader.
- **Wave D — Mailer templates:** create BlinkOne mailer layouts at `app/views/layouts/mailer_blinkone.html.erb`. Override the mailer parent class to use them via ActionMailer view path injection. Do NOT modify Chatwoot's mailer ERBs.

Arabic support (Oman): ensure RTL renders after rebrand. Test widget in `ar` locale. Check if the logo mark looks right mirrored — confirm with me.

# Execution

After each wave: run full test suite; boot staging; screenshot login, dashboard home, conversation view, new ticket email, password reset email, widget on a test page. Paste into `docs/blinkone/REBRAND_PROGRESS.md`.

# Specific careful items

1. **Devise emails** (password reset, account confirmation): partly Devise defaults, partly Chatwoot overrides. Use the BlinkOne mailer layout and override subjects via `config/locales/devise.en.yml` overrides.
2. **Static error pages** — `public/404.html`, `public/500.html`, `public/422.html` bypass Rails entirely. Rewrite.
3. **Onboarding wizard** — "Set up your Chatwoot account" → "Set up your BlinkOne workspace". In `app/javascript/dashboard/routes/auth/Signup.vue`.
4. **Slack notification template** — `app/services/integrations/slack_channel.rb`.
5. **Webhook User-Agent header** — `Chatwoot/x.y.z` → `BlinkOne/x.y.z`. Confirm with me.
6. **`installation_id`** sent to ChatwootHub — leave alone. Set `DISABLE_TELEMETRY=true` env var (supported off-switch).
7. **"Powered by Chatwoot" badge** on the widget — Community Edition keeps this; we replace "Chatwoot" with our partner-facing brand string via the brand-token system. Confirm exact wording with me.

# Order

1. Discovery → inventory → my approval.
2. Wave A (infrastructure).
3. Wave B (visual assets).
4. Wave C (i18n override loader, then strings).
5. Wave D (mailer view path injection, then templates).
6. Final screenshot pass.
```

---

# PROMPT 4 — Sidecar architecture & service skeleton

```text
Chatwoot rebrand is done. Now we set up the architecture for every TRD gap we'll close with sidecar services. This session builds the chassis — no business logic yet.

# Deliverables

## 1. Top-level `services/` directory (NEW)

```
services/
  _shared/
    package.json
    tsconfig.base.json
    eslint.config.mjs
    docker/
      Dockerfile.base
    packages/
      logger/                  # pino with tenant_id + correlation_id binders
      tenant-context/          # JWT verify, AsyncLocalStorage
      event-bus/               # Redis Streams wrapper
      chatwoot-client/         # typed wrapper around Chatwoot REST API
      telemetry/               # OpenTelemetry bootstrap
      openapi-loader/          # OpenAPI → Fastify route helper
      audit/                   # Audit log writer (TR-57)
      rbac/                    # Role check helpers (TR-56)
  gateway/                     # Built this prompt
  routing/                     # ACD — Prompt 5
  ivr/                         # IVR — Prompt 5
  sla/                         # Prompt 6
  escalation/                  # Prompt 6
  ai/                          # Prompt 7
  tenant/                      # Multi-tenant control plane — Prompt 8
  billing/                     # Prompt 9
  integration/                 # Prompt 10
```

pnpm workspace. Root `package.json` + `pnpm-workspace.yaml`. TypeScript strict mode, NestJS + Fastify, Zod for runtime validation, Prisma for DB.

## 2. Docker Compose extension

`docker-compose.blinkone.yml` that EXTENDS existing Chatwoot compose:
```bash
docker compose -f docker-compose.yml -f docker-compose.blinkone.yml up
```

Adds:
- `blinkone-postgres` (PostgreSQL 16 + pgvector) — separate from Chatwoot's DB
- `blinkone-redis` — separate from Chatwoot's Redis
- `blinkone-minio` + `blinkone-minio-init` (buckets: recordings, transcripts, exports, uploads)
- `blinkone-jaeger` (traces, dev)
- `blinkone-prometheus` + `blinkone-grafana` (pre-loaded dashboard)
- `blinkone-keycloak` (IdP — Chatwoot keeps Devise; gateway brokers)
- `blinkone-gateway` (built this prompt)

All sidecars on `blinkone-net` AND existing Chatwoot network, so they reach Chatwoot Rails on its internal hostname.

Named volumes for stateful services. Healthchecks. Resource limits sized for 16-core / 64GB on-prem box.

## 3. `services/gateway/` — the API gateway

NestJS app at `/blinkone/api/v1/*`. Responsibilities:
- Verify Chatwoot session cookie OR JWT issued by gateway. Login flow: user POSTs Chatwoot creds → gateway forwards to Chatwoot `/auth/sign_in` → on success, mints JWT with `tenant_id`, `user_id`, `roles[]`.
- Inject tenant context into downstream calls via signed `X-BlinkOne-Tenant-Id` header.
- Reverse-proxy `/blinkone/api/v1/routing/*` → routing, `/sla/*` → sla, etc.
- Rate limit per tenant + per IP (Redis-backed).
- CORS locked to BlinkOne origins via env.
- `/healthz`, `/readyz`, `/metrics`.
- OpenTelemetry trace propagation.
- Helmet, request-id middleware.
- RBAC enforcement at route level via shared `@blinkone/rbac` package.

## 4. Shared packages (concrete content)

- **`@blinkone/logger`** — pino factory `createLogger({ service })`. Binds tenant_id, correlation_id, user_id from AsyncLocalStorage. Redacts `authorization`, `cookie`, `password`, `card_number`, `phone_number_full`. Pretty in dev, JSON in prod.

- **`@blinkone/tenant-context`** — Fastify plugin verifying gateway-signed header, parsing claims, storing in AsyncLocalStorage. Exports `getTenantContext()`. Throws if accessed without context.

- **`@blinkone/event-bus`** — ioredis Streams wrapper:
  - `publish(stream, event)` validates envelope via Zod
  - `consume(stream, group, consumer, handler, options)` — XREADGROUP loop, XACK on success, exponential-backoff retries, dead-letter to `<stream>.dlq` after N attempts
  - `replay(stream, fromId, handler)` for one-shot replays
  - Idempotency helper (Redis SET NX) so consumers idempotent on `idempotency_key`.

- **`@blinkone/chatwoot-client`** — typed wrapper on Chatwoot V1, V2, Platform APIs. Uses `CHATWOOT_BASE_URL` + per-tenant API tokens (cached from tenant-service in Prompt 8). Methods we'll need: getConversation, sendMessage, addAgent, listInboxes, createConversation, createContact, attachFile, listAccounts (platform), createAccount (platform), getAccountWebhooks, createWebhook.

- **`@blinkone/telemetry`** — OpenTelemetry SDK with OTLP→Jaeger. Auto-instrument http, pg, ioredis, fastify. `initTelemetry({ service })` called from each main.ts.

- **`@blinkone/openapi-loader`** — given OpenAPI 3.1 YAML, registers all operations as Fastify routes, binds handlers by `operationId`, runtime-validates request + response in dev.

- **`@blinkone/audit`** (TR-57) — writer with method `audit(action, target, before?, after?, metadata?)`. Async writes to `blinkone_audit_events` table in `blinkone-postgres`. Cannot be deleted (table has no DELETE policy; rows immutable). Append-only. Indexed by tenant_id + actor_id + occurred_at.

- **`@blinkone/rbac`** (TR-56) — role definitions (admin, supervisor, agent, viewer), permission map (per resource × action), Fastify decorator `@RequiresPermission('billing:read')`. Roles loaded from JWT; permissions checked at gateway AND re-checked at service (defense in depth).

## 5. Per-service scaffolding generator

`services/_shared/scripts/new-sidecar.sh <name>` creates:
- `openapi.yaml` skeleton (healthz, readyz, metrics)
- `prisma/schema.prisma` (with `tenant_id` on every model — enforced by custom Prisma lint rule)
- `src/main.ts` (NestJS bootstrap + telemetry + tenant plugin + audit)
- `src/app.module.ts`
- `Dockerfile` (multi-stage, distroless final, non-root)
- `docker-compose.blinkone.yml` snippet (append-only patch)
- `README.md` template
- `.github/workflows/sidecar-<name>.yml`

## 6. CI

Root `.github/workflows/blinkone-ci.yml` — lints, typechecks, tests every package + sidecar in parallel via path filters. Testcontainers for Postgres + Redis. Build matrix for Node 20 + 22.

# Order

1. pnpm workspace + tsconfig + base Dockerfile
2. Shared packages: logger → tenant-context → event-bus → telemetry → openapi-loader → chatwoot-client → audit → rbac
3. Docker Compose extension (no gateway yet)
4. Gateway service (auth flow → proxy routes → rate limit → RBAC)
5. new-sidecar.sh generator
6. Root CI workflow
7. Verify: `docker compose -f docker-compose.yml -f docker-compose.blinkone.yml up` brings everything online; gateway responds at `http://localhost:8080/blinkone/api/v1/healthz`; login flow works against running Chatwoot.

Show file tree and docker-compose.blinkone.yml before writing TypeScript.
```

---

# PROMPT 5 — Telephony sidecar (TR-06, TR-12–18)

```text
Build voice calling. Inbound + outbound PSTN via SIP trunks, IVR, ACD with skill-based routing, queues, recording, supervisor monitoring. Agents answer in-browser via WebRTC inside the Chatwoot dashboard (Vue plugin).

# Components

## 1. `infra/asterisk/`

- Asterisk 20 Docker image with PJSIP, ARI enabled, mixmonitor for recording.
- Dialplan with ONE entry per direction: `[from-trunk]`, `[from-agent]`. Both immediately `Stasis(blinkone-ivr,...)` — all logic in the ARI app, not the dialplan.
- WebRTC: PJSIP WSS transport, ICE enabled, DTLS cert generation script.
- Per-tenant trunk config templated from `tenants.yaml` (each tenant ≥1 trunks).
- Recording: `MixMonitor` to tenant-namespaced path on shared volume. Worker uploads to MinIO and writes metadata to routing service.

## 2. `infra/kamailio/`

- Kamailio 5.8 as SBC.
- Topology hiding, NAT traversal (RTPEngine container), TLS for trunks, anti-spoofing (PAI/RPID checks), per-source-IP rate limiting.
- Inbound: route to Asterisk based on DID → tenant mapping.
- Outbound: route to right carrier trunk based on tenant outbound rules.

## 3. `services/ivr/`

NestJS app connecting to Asterisk via ARI WebSocket. Responsibilities:
- Listen for `StasisStart`.
- Look up dialed number → tenant + inbox.
- Execute IVR flow (DAG: play prompt, collect DTMF, route to queue, transfer to agent, hang up, schedule callback). Flow definitions in Postgres, versioned.
- Hand off to routing service when flow ends in "route to queue X".

OpenAPI:
- `GET/POST/PATCH /v1/flows`
- `POST /v1/flows/{id}/versions` (every save → new version; never edit history)
- `GET /v1/calls/{callId}/state` (debug)

Tables: `ivr_flows`, `ivr_flow_versions`, `ivr_call_state` (Redis hot + Postgres warm).

Audio: per-tenant prompts in MinIO, signed URLs cached by Asterisk via fetch script. Arabic + English support. Prompts uploaded via admin UI OR TTS-generated on the fly (call AI service Phase 7).

## 4. `services/routing/` (ACD core — TR-13)

NestJS app. Responsibilities:
- Agent state in Redis: `agent:{tenant}:{agentId}` → `{status, currentCallId, lastIdleAt, skills[], occupancy}`.
- Queue state in Redis sorted sets: `queue:{tenant}:{queueId}` sorted by `priorityScore`.
- Subscribe to Chatwoot agent presence (Action Cable or webhook) — sync logged-in/away/busy.
- Selection algorithm (TR-14): skill-match → longest-idle → least-occupied. Configurable per queue.
- `POST /v1/route/request` (called by IVR) → returns agent or "queued".
- `POST /v1/route/assign` → reserves agent, instructs Asterisk via ARI to bridge.
- `POST /v1/route/complete` → frees agent, writes CDR.
- Overflow (TR-15): if queue depth > N or wait time > M, route to alternate queue or voicemail.

Tables: `queues`, `queue_skills`, `agents`, `agent_skills`, `routing_decisions` (audit).

## 5. Supervisor sub-module (TR-17)

- `WS /v1/supervise/sessions` — supervisor websocket, picks a call.
- `POST /v1/supervise/{callId}/mode` with `listen | whisper | barge` — instructs Asterisk via ARI to start the appropriate ChanSpy variant.
- Tenant + role check at gateway AND re-check here.
- Every supervision action audited via `@blinkone/audit`.

## 6. CDR & recordings (TR-16, TR-18)

Tables: `call_sessions`, `recording_objects`. On call end: write CDR (start/end/duration/agent/queue/disposition). Recording metadata includes MinIO key, content-type, encryption-key-id. Encrypt recordings with per-tenant KMS key (start with .env-based key, migrate to Vault later).

`GET /v1/recordings/{id}/url` — signed URL valid 5 minutes. Every access audited.

## 7. Agent dashboard widget

Vue 3 plugin at `app/javascript/dashboard/blinkone_components/PhonePanel/`:
- Floating panel: dialpad, current call info, hold/transfer/conference, queue stats, agent status toggle.
- **JsSIP** for WebRTC SIP signaling to Asterisk via WSS.
- Call events via Action Cable from routing service (mirrored into Chatwoot's Action Cable so agents see screen-pop).
- Screen-pop: on incoming call, look up caller's phone via chatwoot-client; match → open contact's conversation; no match → offer to create.

Feature-flagged on `blinkone.telephony.enabled` so we can disable per tenant.

## 8. Real-time dashboards (TR-19) + agent performance (TR-18)

- `GET /v1/dashboards/realtime` — current call counts per queue, agent statuses, wait times. Pushed via WebSocket every 2s.
- `GET /v1/reports/agents` — historical KPIs: handled calls, AHT (average handle time), occupancy, hold time, abandonment rate. Range-filterable.
- Vue admin pages: `/blinkone/admin/telephony/realtime`, `/blinkone/admin/telephony/reports`.

## 9. Tests

- SIPp test at `tests/sipp/inbound-call.xml` — register, call in, press DTMF, get routed. CI runs against full stack.
- Routing property tests (fast-check): given N random-skilled agents and a queue, chosen agent always satisfies skill requirements AND is longest-idle among qualifying.
- Supervisor authZ: supervisor of tenant A → listen on tenant B call → 403.
- Recording access: agent who didn't handle the call → 403 unless supervisor role.

# Order

1. Asterisk + Kamailio + RTPEngine containers. Hand-test SIP call from softphone through to a parked extension.
2. ivr-service ARI app with hardcoded "play welcome, hang up" flow.
3. Flow Postgres model + CRUD + admin UI (`/blinkone/admin/ivr`).
4. routing-service agent state + queue model.
5. routing-service queue join + selection algorithm.
6. CDR + recording pipeline.
7. Supervisor module.
8. Real-time dashboards + reports.
9. Agent dashboard phone panel.
10. SIPp end-to-end test in CI.

Stop after step 1 for review. This is the most failure-prone phase; rushing it costs weeks.
```

---

# PROMPT 6 — SLA + Escalation sidecars (TR-23, TR-24)

```text
Build SLA tracking and escalation rules. These map to Chatwoot's paid SLA feature — we are NOT enabling or copying that. We build fresh, MIT-licensed, sidecar-based, with deeper functionality than Chatwoot's Enterprise version (SLA targets per channel/priority/business hours, simulation mode for rules).

# `services/sla/`

## Data model

- `sla_policies` — id, tenant_id, name, description, enabled, default (only one per tenant), business_hours_calendar_id, created_at, updated_at.
- `sla_targets` — id, policy_id, applies_when (JSONB: priority IN [...], channel IN [...], inbox_id IN [...]), target_type (first_response | next_response | resolution), threshold_minutes, warning_threshold_pct (default 80).
- `business_hours_calendars` — id, tenant_id, name, timezone (IANA), holidays (JSONB array), weekday_hours (JSONB: monday: [{start: "08:00", end: "17:00"}], ...).
- `sla_instances` — id, tenant_id, conversation_id (chatwoot), policy_id, target_id, started_at, due_at, paused_at_total_ms, paused_since (nullable), status (active | paused | met | breached | warning_sent), met_at, breached_at.
- `sla_events` — append-only audit: instance_id, event_type (created | paused | resumed | warned | met | breached | recalculated), at, snapshot (JSONB).

## Behavior

- Subscribe to Chatwoot webhooks (via integration sidecar, Prompt 10): `conversation_created`, `conversation_status_changed`, `message_created`, `conversation_resolved`, `conversation_reopened`, `conversation_updated` (priority).
- Webhooks republished as `chatwoot.conversation.*` events; SLA service subscribes.
- On `conversation_created`: pick matching policy (eval `applies_when`), create one sla_instance per relevant target.
- On agent reply: close first_response targets; start next_response timers.
- On customer reply: re-open next_response timers.
- On status → `pending` or `snoozed`: pause SLA. On → `open`: resume.
- On resolve: close resolution targets.
- Business hours: when computing `due_at` and elapsed, count ONLY minutes inside business hours (`WorkingTime` helper, property-tested).
- Worker: every 30s, scan active instances. `now >= due_at` → breached, emit `sla.breached`. `now >= due_at - threshold_pct * total` → warning, emit `sla.warning`.

## Endpoints

- Policies + targets + calendars: CRUD.
- `GET /v1/conversations/{id}/sla` → all instances.
- `POST /v1/sla/recalculate` (admin) → idempotent rebuild for date range.

## UI

Vue admin pages at `app/javascript/dashboard/blinkone_components/sla/`:
- `/blinkone/admin/sla/policies` — list, create, edit.
- `/blinkone/admin/sla/calendars` — business hours editor with timezone picker, holiday picker.
- `/blinkone/admin/sla/dashboard` — live view of at-risk and breached conversations.
- Embedded badge in conversation header showing live SLA countdown (Action Cable subscription).

# `services/escalation/`

## Data model

- `rulesets` — tenant_id, name, enabled.
- `rules` — ruleset_id, name, trigger (event_type from whitelist), conditions (JSON-Logic), actions (array).
- `rule_runs` — rule_id, triggered_at, input_event (snapshot), conditions_passed, actions_attempted, outcomes, error.

## Triggers (whitelist)

- `sla.warning`, `sla.breached`
- `conversation.unassigned_for_minutes` (synthetic, by watcher)
- `conversation.no_response_for_minutes` (synthetic)
- `conversation.priority_changed_to`
- `call.abandoned_in_queue` (from routing)
- `call.long_wait` (from routing)

## Actions (whitelist — extensible)

- `reassign_to_team(team_id)`
- `reassign_to_agent(agent_id)`
- `change_priority(priority)`
- `add_label(label)`
- `post_internal_note(template_id, variables)`
- `send_webhook(endpoint_id)` (delegates to integration)
- `notify_slack(channel)` (via integration)
- `bump_queue_priority(queue_id, delta)` (delegates to routing)

## Conditions

**JSON-Logic ONLY. No `eval`. No code execution.** Predefined variables: `event.*`, `conversation.*`, `customer.*`, `agent.*`, `business_hours.*`. Limit JSON-Logic depth and operator set via a whitelist validator at save time.

## Simulation mode

`POST /v1/rules/simulate` — accepts a rule + sample event, returns whether conditions match and which actions would fire. Read-only. Used by admin UI's rule builder.

## UI

`/blinkone/admin/escalations` — rule builder with tree-view UI (each rule node = JSON-Logic op). Action picker with parameter forms. "Test rule" button calling simulate endpoint.

# Cross-cutting

- Both services horizontally scalable. Redis Redlock when computing SLA on the same conversation (prevent double-write).
- Seed task `pnpm seed:sla` — creates 3 sample policies (Gold/Silver/Bronze) and 5 sample rules for the demo tenant.

# Tests

- Property-based SLA calc (fast-check): business hours edge cases (Friday-evening start, holiday in middle, DST transitions, leap day).
- Integration: create conversation at T0, fast-forward time (sinon fake timers + DB time injection), assert `sla.warning` fires at exactly 80%.
- Rule simulator: cover every action type and every trigger.

# Order

1. OpenAPI specs (both services) + Prisma schemas + state diagrams (Mermaid in ADRs).
2. Wait for review.
3. business_hours_calendars + WorkingTime helper + property tests.
4. SLA service: policies + targets CRUD, instance creation on conversation events.
5. SLA worker (breach/warning detection).
6. SLA UI pages.
7. Escalation service: rulesets + rules CRUD, JSON-Logic evaluator with whitelist.
8. Escalation actions (start with reassign + change_priority + add_label; webhook + slack require integration sidecar from Prompt 10).
9. Simulation endpoint + tests.
10. Escalation UI.

Show OpenAPI + Prisma + state diagrams before writing handlers.
```

---

# PROMPT 7 — AI sidecar (TR-29 to TR-36)

```text
Build the AI layer: Arabic voice bot, GPT-powered agent assist (reply suggestions, summaries), STT for call recordings, sentiment analysis, auto ticket classification, RAG knowledge base.

# `services/ai/`

NestJS app. Single sidecar with multiple workers + a dialog runtime.

## Architecture

- **LLM gateway** — abstraction over OpenAI, Anthropic, Azure OpenAI, local (Ollama) providers. Tenant-configurable. Per-tenant API keys stored encrypted (per-tenant KMS key). Default to Azure OpenAI (Gulf region) for data residency (TR-54).
- **STT gateway** — abstraction over Azure Speech, Google STT, AWS Transcribe, local Whisper. Arabic dialect support critical (Gulf Arabic, MSA). Confirm provider with me.
- **TTS gateway** — Azure Neural TTS or ElevenLabs. Arabic voices required.
- **Vector store** — pgvector inside blinkone-postgres. Per-tenant collections.
- **PII redactor** — pre-LLM filter: strip phone numbers, emails, national IDs, card numbers, IBANs before sending to external LLM. Configurable per tenant (some clients may allow PII passthrough for their own LLM endpoint).
- **Quota & metering** — every LLM/STT/TTS call written to `ai_usage_events` for billing (Prompt 9).

## Endpoints

- `POST /v1/chat/completions` (internal, used by other sidecars) — wraps configured LLM provider with tenant routing + PII redact + metering.
- `POST /v1/stt/jobs` — submit audio (MinIO key), return job id. Async processing.
- `GET /v1/stt/jobs/{id}` — status + transcript when ready.
- `POST /v1/tts` — text + voice → MinIO key for the audio.
- `POST /v1/rag/index` (admin) — index a document into a tenant collection.
- `POST /v1/rag/query` — semantic search returning chunks with citations.
- `POST /v1/classify/ticket` — classify a conversation into (category, priority, language, intent). Used by ticket auto-routing.
- `POST /v1/sentiment` — per-message sentiment (-1 to +1) + emotion labels.
- `POST /v1/summarize/conversation` — agent-facing summary of a Chatwoot conversation.
- `POST /v1/suggest/reply` — given conversation context + tenant's RAG, suggest 3 reply variants.
- `POST /v1/voice/sessions` — start a voice-bot session (returns session id).
- `POST /v1/voice/sessions/{id}/turn` — submit caller audio chunk reference, get bot's response audio reference + dialog state.

## Data model

- `ai_providers_per_tenant` — encrypted API keys.
- `ai_usage_events` — every call, tokens in/out, cost-cents, latency_ms, success.
- `rag_collections`, `rag_documents`, `rag_chunks` (with pgvector embeddings).
- `voice_sessions`, `voice_turns` (with audio refs in MinIO + transcripts).
- `classification_models` (per tenant) — fine-tuned or zero-shot config.

## Arabic voice bot (TR-29) — the hardest piece

- **Dialog state machine** per session. States: `greeting`, `listening`, `processing`, `responding`, `transferring`, `ended`.
- **Streaming STT** — Asterisk pipes audio to ivr-service, ivr-service forwards to ai-service over WebSocket. ai-service streams to the STT provider.
- **Barge-in** — when user starts speaking mid-prompt, Asterisk stops TTS playback (handled by ivr-service via ARI), and ai-service treats the new utterance as the next turn.
- **Intent detection** — call LLM with a system prompt scoped to the tenant's domain + tenant's RAG context, return structured intent + parameters.
- **Fallback to agent** — after N misunderstandings (configurable), the bot says (in Arabic) "transferring you to an agent" and signals routing-service to inject a queue request.
- **Memory** — voice session memory bounded (last K turns). Persisted to Postgres for analytics.
- **Test corpus** — `tests/ai/voice/arabic-scenarios.yaml` with 30 dialect-varied test scripts (Omani, Saudi, Egyptian MSA, Levantine, mixed Arabic-English code-switching). CI runs these against a mocked STT/LLM and asserts dialog reaches correct end state.

## Agent assist (TR-31, TR-34)

- Vue component `app/javascript/dashboard/blinkone_components/AgentAssist/` — sidebar in the conversation view.
- Buttons: "Suggest reply", "Summarize", "Detect intent", "Find similar past cases".
- Calls AI service via gateway. Streams responses for low-latency feel.

## Auto classification (TR-33)

- Subscribes to `chatwoot.conversation.created`. After first customer message arrives, calls `/v1/classify/ticket`, applies labels + priority to the Chatwoot conversation via chatwoot-client. Marked as "by BlinkOne AI" in conversation audit.

## Sentiment (TR-32)

- Subscribes to `chatwoot.message.created` (customer side). Calls sentiment endpoint. Writes score + emotion to `blinkone_message_signals` table. Surfaced in conversation header + escalation triggers (negative sentiment trend → escalate).

## STT for calls (TR-35)

- Subscribes to `call.session.completed`. Pulls recording from MinIO. Submits to STT. On completion, writes transcript to `call_transcripts` (with speaker diarization if provider supports). Indexes into the tenant's RAG collection (for self-improving knowledge base). Surfaces in call detail UI.

## RAG knowledge base (TR-36)

- Admin uploads documents (PDF, DOCX, HTML, markdown) at `/blinkone/admin/ai/knowledge-base`.
- Worker chunks (≈500 token chunks, 50 token overlap), embeds, stores in pgvector.
- Query endpoint returns top-K chunks with source citations.
- Used by voice bot, agent assist, and reply suggestions.

# Tests

- Provider abstraction: mock LLM provider; assert tenant routing, PII redaction, metering all fire.
- Arabic scenarios end-to-end against mocked STT/LLM.
- RAG quality: a corpus of 100 Q&A pairs; retrieved chunks must contain the answer for ≥80% (regression bar).
- PII redactor: never sends an Omani phone number (+968...), national ID, IBAN to the LLM.

# Order

1. OpenAPI + Prisma schema. Wait for review.
2. LLM gateway + provider adapters + PII redactor + metering.
3. STT + TTS gateways.
4. RAG: ingestion, chunking, embedding, query.
5. Classification, sentiment, summarize, suggest endpoints.
6. Agent assist Vue sidebar.
7. Subscribers: auto-classify, sentiment-on-message, STT-on-call.
8. Voice bot dialog state machine + barge-in + handoff.
9. Arabic test corpus + CI gauntlet.

Confirm with me BEFORE starting:
- LLM provider (Azure OpenAI Gulf region preferred for residency)?
- STT provider for Arabic (Azure Speech vs. Google vs. local Whisper)?
- TTS provider for Arabic neural voices?
- Per-tenant or platform-wide API keys?
```

---

# PROMPT 8 — Multi-tenant + white-label (TR-37 to TR-41)

```text
Make BlinkOne true multi-tenant white-label SaaS — one install, many LABBIK clients, each with their own branding, isolated data, isolated workflows.

# Concept

Chatwoot already has "Accounts" — we treat one Chatwoot Account = one BlinkOne tenant = one LABBIK client. The new `services/tenant/` sidecar is the control plane that LABBIK staff use to provision new clients.

# `services/tenant/`

## Data model

- `tenants` — id (= chatwoot_account_id), name, slug, status (active | trial | suspended | terminated), created_at, owner_email, primary_contact_phone, billing_plan_id (FK to billing).
- `tenant_features` — tenant_id, feature_key, enabled, config (JSONB). Feature flags per tenant (telephony, voice_bot, sso, rag, etc.).
- `tenant_branding` — tenant_id, brand JSONB (extends defaults from Prompt 2). Hostname/subdomain mapping.
- `tenant_domains` — tenant_id, domain (e.g. `support.client1.com`), is_primary, ssl_status, verification_token.
- `tenant_api_keys` — tenant_id, key_hash, scopes, created_by, last_used_at, expires_at.
- `tenant_admins` — tenant_id, chatwoot_user_id, role (owner | admin | viewer). Separate from Chatwoot's agent roles — these are platform-level.

## Endpoints

- `POST /v1/tenants` (platform-admin only) — provisions:
  1. Creates Chatwoot Account via Platform API (using chatwoot-client).
  2. Creates owner user, sets initial password (one-time-link emailed).
  3. Inserts `tenants` row.
  4. Seeds default branding, default SLA policy, default queues, default feature flags.
  5. If telephony enabled: provisions a default SIP trunk profile.
  6. Returns tenant id + onboarding URL.
- `GET/PATCH /v1/tenants/{id}` — read/update.
- `POST /v1/tenants/{id}/suspend` — flips status, fires `tenant.suspended` event (every sidecar listens and stops serving).
- `POST /v1/tenants/{id}/domains` — add custom domain. Issues an ACME challenge; on success, runtime SSL.
- `GET /v1/tenants/{id}/usage` — aggregated usage from billing/AI/routing for the dashboard.

## Tenant isolation enforcement (TR-38)

- **Postgres RLS (row-level security)** on every sidecar table. Policy: `tenant_id = current_setting('app.tenant_id')::uuid`. Connection-level setting injected by tenant-context middleware. Fail-closed — if no tenant in context, query returns zero rows.
- **MinIO bucket policy** — recordings and uploads namespaced `{bucket}/tenants/{tenant_id}/...`. IAM-style policy denies cross-tenant reads.
- **Redis key namespacing** — every key prefixed `t:{tenant_id}:`. A helper enforces this; no raw Redis access allowed.
- **Cross-tenant test** — for every sidecar, a test boots tenant A and tenant B, performs a write as A, asserts B's user gets 404/empty when reading. Required in CI.

## Domain routing for white-label (TR-39)

- `blinkone-gateway` reads `Host` header → looks up tenant_domain → resolves tenant_id → loads tenant branding → injects into JWT.
- Per-tenant subdomain default: `{slug}.blinkone.example`. Custom domains supported via CNAME + ACME (use lego or acme.sh in a sidecar cron).
- Chatwoot's installation_url config doesn't natively support multi-domain — we override via a Rails middleware (`app/middleware/blinkone_host_resolver.rb`) marked `# BLINKONE:` that sets `request.env['BLINKONE_TENANT_ID']` for downstream Chatwoot code. Where Chatwoot reads `ENV['FRONTEND_URL']`, we shadow it with `BlinkOne::Branding.for_tenant(...).frontend_url`.

## Per-tenant workflows (TR-40)

- IVR flows, SLA policies, escalation rules, queues, branding, AI prompts — ALL tenant-scoped already by sidecar design. Verify and add cross-tenant assertion tests.
- Chatwoot's inboxes, teams, labels, custom attributes — already account-scoped natively. Nothing to do; confirm.

## RBAC per tenant (TR-41)

- Platform-level roles (LABBIK staff): `platform_admin`, `platform_support`, `platform_billing`.
- Tenant-level roles (client staff): `tenant_owner`, `tenant_admin`, `supervisor`, `agent`, `viewer`.
- A platform_admin can switch tenant context (impersonate), with every action audited (`@blinkone/audit`).
- Tenant users locked to their tenant; cross-tenant API calls return 403.

## Onboarding UI

`/blinkone/platform/tenants` — LABBIK staff UI:
- List all tenants, status badges, MRR.
- "New tenant" wizard — name, domain, primary contact, plan, feature flags.
- Tenant detail page — usage charts, recent activity, support tools (resend invite, impersonate, suspend).

`/blinkone/admin/branding` — tenant admin UI:
- Logo upload, color picker, font selector, custom CSS (sanitized).
- Domain settings — add custom domain, view DNS instructions, SSL status.
- Live preview pane showing the dashboard with the new branding applied.

# Tests

- Provisioning end-to-end: API call → assert Chatwoot account created, owner user created, branding seeded, all sidecars see the new tenant.
- Cross-tenant isolation gauntlet: 50+ assertions across every sidecar that tenant A cannot read tenant B.
- Domain routing: requests with Host `client1.example` → tenant 1's branding; `client2.example` → tenant 2's branding.
- Suspension: when tenant suspended, all sidecar endpoints return 423 (Locked), agent dashboard shows suspension banner.

# Order

1. tenant-service OpenAPI + Prisma. Wait for review.
2. Provisioning endpoint + Chatwoot Platform API integration.
3. RLS migration applied to every existing sidecar table.
4. Redis key-namespacing helper + retrofit existing sidecars.
5. Gateway host-resolver + branding injection.
6. Rails BlinkoneHostResolver middleware.
7. Custom domain + ACME automation.
8. Platform admin UI.
9. Tenant admin branding UI.
10. Cross-tenant test gauntlet — must pass before declaring this prompt done.

Stop after step 3 (RLS migration) for review. RLS misconfigured = data leak; don't ship until I sign off.
```

---

# PROMPT 9 — Billing sidecar (TR-42 to TR-45)

```text
Build subscription management, usage metering, invoicing. LABBIK sells BlinkOne to clients on per-agent and usage-based plans.

# `services/billing/`

## Data model

- `plans` — id, name, tier (starter | business | enterprise), base_price_omr, included_agents, included_minutes, included_messages, included_ai_credits, billing_period (monthly | quarterly | annual).
- `plan_overage_rates` — plan_id, dimension (agent | minute | message | ai_token | sms | recording_storage_gb), rate_omr_per_unit.
- `subscriptions` — tenant_id, plan_id, status (trial | active | past_due | suspended | cancelled), current_period_start, current_period_end, trial_ends_at, cancel_at_period_end, payment_method_id.
- `usage_events` — append-only firehose: id, tenant_id, dimension, quantity, occurred_at, source_service, source_event_id (for idempotency). Partitioned by month.
- `usage_aggregates_daily` — rollup table for fast reads: tenant_id, date, dimension, total_quantity, total_cost_omr.
- `invoices` — tenant_id, period_start, period_end, subtotal_omr, vat_omr, total_omr, status (draft | sent | paid | overdue | void), pdf_minio_key, issued_at, due_at, paid_at.
- `invoice_lines` — invoice_id, description, quantity, unit_price_omr, amount_omr.
- `payments` — invoice_id, method (card | bank_transfer | manual), provider_ref, amount_omr, paid_at, status.
- `payment_methods` — tenant_id, type, last4, provider_token (encrypted), is_default.

## Usage producers (already emitting events; this sidecar consumes)

- routing → `usage.minute` per completed call (with direction, agent_id).
- ai → `usage.ai_token` per LLM call, `usage.stt_minute`, `usage.tts_char`.
- gateway → `usage.message` per agent reply sent.
- tenant → `usage.agent` per active agent per day.
- routing → `usage.recording_gb` rolled up nightly from MinIO usage.

billing-service subscribes, deduplicates on source_event_id, writes to usage_events, nightly worker rolls up to usage_aggregates_daily.

## Endpoints

- Plans + overage rates: CRUD (platform admin).
- `POST /v1/tenants/{id}/subscription` — assign plan, start subscription.
- `POST /v1/tenants/{id}/subscription/cancel` (immediate or end-of-period).
- `GET /v1/tenants/{id}/usage` — usage for current period vs. allowance.
- `POST /v1/invoices/generate` — for a tenant + period (idempotent). Computes overages, creates invoice + lines, renders PDF.
- `POST /v1/invoices/{id}/send` — emails the invoice PDF.
- `POST /v1/invoices/{id}/mark-paid` (manual, audited) — for bank transfers.
- `POST /v1/payment-methods` — adds a card via the chosen PSP (regional preference: confirm with me — likely Thawani or Tap for Oman).
- `POST /v1/webhooks/psp` — receives PSP callbacks (charge succeeded/failed/refunded), verifies signature, updates payments/invoice.

## Dunning

- Worker: 3 days before period_end → email reminder. On period_end with no payment method → mark `past_due`, fire `tenant.past_due` (tenant-service listens, may suspend after grace period configurable per plan).
- Failed charge: retry on day 1, 3, 7. After last retry, fire `subscription.payment_failed_terminal`.

## VAT & currency (Oman: 5% VAT, OMR)

- Default currency: OMR.
- VAT rate configurable per-tenant (some tenants may be VAT-exempt or in different GCC countries with different rates).
- Invoice PDF: bilingual Arabic + English, includes LABBIK's CR number, VAT registration number, tenant's CR + VAT (custom fields).

## UI

- `/blinkone/platform/billing` — LABBIK staff: revenue overview, MRR, ARR, churn, plan distribution, upcoming renewals, overdue invoices.
- `/blinkone/platform/plans` — plans CRUD.
- `/blinkone/admin/billing` — tenant admin: current plan, usage gauges, invoices list + download, payment methods, plan upgrade flow.

## Tests

- Idempotency: same `source_event_id` arrives twice → only one usage row.
- Overage math: synthesize a tenant with included 1000 minutes, actual 1500 → invoice line shows 500 × overage_rate.
- VAT: synthesize a 100 OMR subtotal with 5% VAT → invoice total 105 OMR; bilingual PDF renders.
- Dunning: simulate failed payment → assert correct retry schedule + final suspension event.
- Cross-tenant: tenant A invoice never visible to tenant B (RBAC + RLS).

# Order

1. OpenAPI + Prisma. Wait for review.
2. Plans + overage CRUD.
3. Usage event consumer + aggregator.
4. Subscription lifecycle.
5. Invoice generation + PDF render (bilingual).
6. PSP integration (confirm provider).
7. Dunning worker.
8. Platform billing UI.
9. Tenant billing UI.

Confirm with me BEFORE starting:
- PSP (Thawani / Tap / NetSuite / manual-only initially)?
- Default currency OMR confirmed?
- LABBIK's CR + VAT number for invoice template?
```

---

# PROMPT 10 — Integration sidecar (TR-46 to TR-50, TR-57)

```text
Build the enterprise integration plane: SSO/AD, ERP webhooks, third-party API connectors, signed outbound webhooks, the audit log viewer.

# `services/integration/`

## Sub-modules

### A. SSO broker (TR-49)

- Keycloak is the IdP (already in compose from Prompt 4).
- This sidecar configures Keycloak realms per tenant via the Keycloak Admin API.
- Each tenant can configure:
  - OIDC IdP (Azure AD, Google Workspace, Okta).
  - SAML IdP (older AD FS, on-prem ADFS).
  - LDAP / AD direct bind (for clients without modern SSO).
- Login flow: user hits `/blinkone/auth/login?tenant=<slug>` → redirected to tenant's Keycloak realm → tenant's IdP → back to Keycloak → back to gateway → gateway mints BlinkOne JWT → also creates/syncs Chatwoot agent user via Platform API (so agents appear in Chatwoot inbox).
- Just-in-time provisioning: first-time SSO login creates the Chatwoot user with the role mapped from SAML/OIDC claims (claim `groups` → BlinkOne role).
- Per-tenant SSO config UI at `/blinkone/admin/sso`.

### B. Outbound webhook engine (TR-47)

- `webhook_endpoints` — tenant_id, name, url, secret_hash, events_subscribed (array), enabled, headers (extra), retry_policy.
- `webhook_deliveries` — endpoint_id, event_id, attempt, status (pending | succeeded | failed | dead), request_body, response_status, response_body_truncated, attempted_at, next_retry_at.
- Subscribes to ALL BlinkOne bus events. For each tenant's endpoints whose subscription matches, enqueues a delivery.
- Signs requests: `X-BlinkOne-Signature: t=<unix>,v1=<hmac-sha256>`. Documented for clients.
- Retries: 1m, 5m, 30m, 2h, 12h, 24h, then dead-letter. UI shows failed deliveries with "retry" button.
- Test endpoint: "send sample event" button in admin UI.

### C. ERP / government connectors (TR-48)

- Connector framework: each connector implements a TypeScript interface `BlinkOneConnector` with `connect()`, `disconnect()`, `push(event)`, `pull()`, `healthcheck()`.
- Initial connectors (skeletons + ONE concrete):
  - **Generic REST connector** — config: base URL, auth (basic | bearer | hmac), endpoint mappings (events → HTTP requests).
  - **SAP B1 connector** — pushes new tickets as Service Calls (skeleton, confirm with me).
  - **Microsoft Dynamics 365** connector (skeleton).
  - **Oracle Fusion** connector (skeleton).
  - **Omani Tasdeeq / government SSO** placeholder (confirm spec with me).
- Each connector has tenant-scoped config + secret storage.
- `/blinkone/admin/integrations` — admin UI to enable, configure, test connectors.

### D. Inbound webhook receiver

- Chatwoot fires webhooks on conversation events. This sidecar is Chatwoot's webhook target. It verifies the Chatwoot webhook signature, normalizes into BlinkOne event envelope, publishes to bus. SLA, escalation, AI all subscribe.
- Also receives PSP webhooks for billing.
- `POST /webhooks/chatwoot`, `POST /webhooks/psp/{provider}`.

### E. Audit log API + viewer (TR-57)

- `@blinkone/audit` package (built in Prompt 4) writes to `blinkone_audit_events`.
- This sidecar exposes `GET /v1/audit` with filters: actor_id, action, target_type, target_id, date range. Paginated. Tenant-scoped (RLS).
- `/blinkone/admin/audit` — searchable timeline UI. CSV export.
- Retention: configurable per tenant (default 7 years for GCC regulatory compliance — confirm).

## REST API + docs (TR-46, TR-50)

- Every BlinkOne sidecar already has an OpenAPI spec.
- This sidecar mounts a `/blinkone/api/docs` route serving:
  - Aggregated OpenAPI (all sidecars merged).
  - Swagger UI + Redoc options.
  - Per-tenant API key generation UI.
  - Code samples (curl, Node, Python, PHP).
- Tenants get their own API base URL: `https://api.blinkone.example/v1/...` with API key auth (separate from the gateway's JWT — for server-to-server).

## Tests

- SSO end-to-end: configure mock OIDC IdP → login → assert Chatwoot user created with mapped role.
- Webhook signature: clients can verify with documented HMAC scheme.
- Webhook retry: failing endpoint retried per policy, dead-lettered after final attempt.
- Audit immutability: attempt to UPDATE or DELETE rows in `blinkone_audit_events` → DB-level error (REVOKE on UPDATE/DELETE for the app role).
- Audit completeness: every state-changing API call across every sidecar writes an audit row (CI test enumerates handlers + asserts audit writer was invoked).

# Order

1. OpenAPI + Prisma. Wait for review.
2. Webhook receiver (Chatwoot + PSP) → bus republisher.
3. Outbound webhook engine + admin UI.
4. SSO broker — Keycloak realm provisioner + tenant config UI.
5. Connector framework + Generic REST + ONE concrete ERP connector.
6. Audit API + viewer UI.
7. Aggregated API docs portal.

Confirm with me BEFORE starting:
- Which ERP is the priority first concrete connector? (SAP B1 / D365 / Oracle / Other?)
- Audit retention default (7 years?)
- Which Omani government system, if any, needs integration? (Tasdeeq, Sahim, etc.)
```

---

# PROMPT 11 — Verification, documentation, handover

```text
We are done building. Now we prove the system works, write the handover materials LABBIK contracted for (TR-70 to TR-73), and produce the vendor deliverables (Section 18 of the TRD).

# Deliverables

## 1. Acceptance test gauntlet

Build `tests/acceptance/` — Playwright + Node test scripts that exercise every TR-XX requirement in the TRD. One test per requirement. Each test:
- Logs in as the right role.
- Performs the user action.
- Asserts the system state.
- Records a screenshot or transcript artifact.

The runner produces `acceptance-report.html` — a TR-matrix-aligned report LABBIK can sign off on.

Specifically test:
- TR-29 Arabic voice bot: a fake SIP call, recorded audio "كيف يمكنني تغيير كلمة المرور؟", asserts the bot's Arabic response references the password-reset KB article.
- TR-37–41 Multi-tenant: provision two tenants, create same-name labels in each, assert they don't collide.
- TR-49 SSO: mock OIDC IdP, login as a SAML-claimed `admin` user, assert Chatwoot user created with admin role.
- TR-55 Encryption: dump the recordings bucket, attempt to read a file directly → encrypted blob, not playable.
- TR-58 MFA: enable MFA on a user, assert login requires TOTP.
- TR-67 KPIs: drive 100 fake calls + 50 fake conversations, assert dashboard numbers match.

## 2. Performance & scale tests

`tests/load/` using k6:
- Routing service: 500 concurrent agents, 10 calls/sec inbound, assert p95 routing decision <100ms (TR-61, TR-62).
- AI service: 50 concurrent voice sessions, assert STT round-trip p95 <800ms.
- SLA service: 100K active conversations under SLA tracking, assert breach detection runs within the 30s window.
- Gateway: 5K RPS sustained, assert error rate <0.1%.

Results → `docs/blinkone/PERFORMANCE_BASELINE.md`.

## 3. Security audit pass

- `npm audit` / `pnpm audit` clean across all sidecars.
- Bundler audit clean on Chatwoot fork.
- Trivy scan on every Docker image — no HIGH or CRITICAL CVEs.
- OWASP ZAP baseline scan against staging.
- Manual review checklist (`docs/blinkone/SECURITY_REVIEW.md`):
  - Every endpoint has authn + authz + tenant filter.
  - No secrets in git history (use truffleHog).
  - Every Postgres table has RLS or documented justification.
  - Every MinIO access is signed-URL-only.
  - No `eval`, no `Function()`, no template-string SQL.
  - mTLS hooks present in inter-service calls.
  - CORS policy reviewed.
  - Rate limits configured.

## 4. Vendor deliverables (TRD Section 18)

Produce a single `BlinkOne-Deliverables-v1.0/` package:
- **Source code** — git bundle of `blinkone/main` at the release tag, including the Chatwoot fork + all sidecars. Plus `THIRD_PARTY_LICENSES.md` enumerating every dependency.
- **Technical documentation** — `docs/blinkone/` rendered to HTML (`mkdocs` or `docusaurus`):
  - Architecture overview with diagrams (Mermaid → SVG).
  - Per-service docs (purpose, endpoints, data model, events).
  - Database schema diagram (`schemaspy` or `dbdocs`).
  - Event catalog (every event_type + producer + consumers + schema).
- **API documentation** — aggregated OpenAPI + Redoc HTML.
- **Architecture diagrams** — system context, container, component (C4 model) + data flow + deployment topology.
- **Deployment guides** —
  - `docs/blinkone/deploy/on-prem.md` — single-server (compose) deployment.
  - `docs/blinkone/deploy/ha.md` — HA deployment (separate hosts for Postgres / Redis / app tier; load balancer; backup strategy).
  - `docs/blinkone/deploy/scale-out.md` — adding sidecar replicas, sharding routing-service.
  - `docs/blinkone/deploy/dr.md` — disaster recovery runbook.
  - `docs/blinkone/deploy/upgrade.md` — upstream Chatwoot merge process.
- **Training materials** —
  - Admin guide (PDF, ~50 pages).
  - Agent guide (PDF, ~20 pages).
  - Developer onboarding (Markdown).
  - Video script for a 30-min platform walkthrough (LABBIK records the video).
- **Runbooks** —
  - Recording bucket fills up → cleanup procedure.
  - Asterisk crashes → recovery.
  - LLM provider outage → fallback procedure.
  - Tenant requesting data export (GDPR-style).
  - Tenant offboarding (data export + deletion).

## 5. Knowledge transfer plan (TR-72, TR-73)

`docs/blinkone/KT_PLAN.md` — a 4-week schedule:
- Week 1: Architecture walkthrough + dev environment setup. LABBIK devs clone, build, run locally.
- Week 2: Hands-on per-sidecar. Each sidecar's lead walks through its code + walks LABBIK devs through making a sample change.
- Week 3: Operations — backups, monitoring, on-call. LABBIK devs run a drill: simulated outage, they restore from backup.
- Week 4: Customization — building a new connector, adding a new IVR action, adding a new escalation action. LABBIK devs each ship a small feature.

## 6. Commercial deliverables (TRD Section 19)

Draft `BlinkOne-Commercial-Proposal.md`:
- Licensing: MIT for the BlinkOne stack we built; Chatwoot Community is MIT upstream; clear statement that NO Chatwoot Enterprise components are included.
- Source code ownership: full transfer to LABBIK (or perpetual unlimited-modification license — confirm with me).
- Implementation cost breakdown (you fill).
- Support tiers (Bronze/Silver/Gold) with SLAs.
- AI pricing model: tenant pays LABBIK; LABBIK pays underlying LLM/STT/TTS providers; markup transparent.
- Upgrade & maintenance: quarterly upstream Chatwoot merges, security patches within 72 hours of disclosure.

# Order

1. Acceptance test gauntlet (writes alongside features, but finalize here).
2. Performance baseline.
3. Security audit pass — fix every finding before sign-off.
4. Documentation rendering (mkdocs build).
5. Deployment guides + runbooks.
6. Training materials.
7. KT plan.
8. Commercial proposal draft.

When all 8 are done, produce `HANDOVER_CHECKLIST.md` — a one-page checklist LABBIK signs to accept delivery.
```

---

# Operational tips while using this pack

1. **Always start a new Cursor Composer chat for each prompt.** Context bloat is real; a fresh chat keeps Cursor sharp.

2. **Keep `.cursorrules` in the repo root** — it's the only thing Cursor reads automatically every chat. Everything else you paste manually.

3. **Pin Cursor's model to the strongest available** (Claude or GPT frontier model). Cheap models will write code that compiles but quietly violates the license rules.

4. **Review before each "Order" step ends.** The prompts deliberately ask Cursor to pause. Don't auto-approve — read the OpenAPI spec and the migration before letting Cursor write 50 handlers.

5. **Commit after every prompt completes.** Use a message format like `[blinkone-p5] telephony sidecar — routing service + IVR ARI app`. Makes upstream-drift triage tractable.

6. **Run the pre-commit hook from Prompt 1 globally.** It will save you from accidentally staging an `enterprise/` file when Cursor gets creative.

7. **When Cursor suggests "let me just port this from enterprise/...":** stop. Reject. Re-paste the license rule. The model knows the rule but will sometimes try to help "efficiently" by reading the blocklist. Don't let it.

8. **Run the cross-tenant gauntlet from Prompt 8 weekly,** not just once. Multi-tenancy is the easiest thing to silently break.

9. **Keep an `ADR/` directory.** Every non-obvious choice gets a numbered ADR. Future-you (and LABBIK's future devs) will thank you.

10. **Build a "demo tenant" seed task early** (`pnpm seed:demo`). Lets you exercise every flow locally without filling production with test data.
