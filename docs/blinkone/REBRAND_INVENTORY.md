# BlinkOne rebrand inventory (discovery pass)

**Status:** Discovery only — no code changes in this pass.  
**Upstream scanned:** [Chatwoot v4.13.0](https://github.com/chatwoot/chatwoot/releases/tag/v4.13.0) (CE, excluding `enterprise/`).  
**BlinkOne deploy repo:** Docker image + env (no Rails/Vue source in-tree yet).  
**Generated:** 2026-05-20  
**Machine-readable dump:** `docs/blinkone/REBRAND_INVENTORY.json` (4,221 matched lines; re-run `python scripts/blinkone/scan-rebrand-inventory.py` after re-cloning upstream).

---

## Executive summary

| Scope | Approx. matches | Rebrand approach |
|-------|-----------------|------------------|
| Dashboard i18n (`app/javascript/dashboard/i18n/`) | **1,961** | Wave C — `blinkone_overrides.json` per locale (do not edit upstream `en.json` directly) |
| Widget i18n (`app/javascript/widget/i18n/`) | **54** | Wave C — overrides + `POWERED_BY` string |
| Email / Liquid templates | **15+** user-visible | Wave D — BlinkOne mailer layouts + Liquid overrides |
| Installation config seeds | **31** branding-related keys | Wave A — Super Admin / env + `config/blinkone/branding.yml` |
| Public metadata (manifest, favicons) | **23** | Wave A + B — env + static assets at `/blinkone-brand/` |
| Ruby/Vue internal identifiers (`ChatwootHub`, `chatwootConfig`) | **~2,100** in category `99_other` | **Do not rename** — not user-visible; breaks upgrades |
| BlinkOne deploy repo (this workspace) | **~40** infra references | Keep service names; user-facing via env only |

---

## Part A — BlinkOne deploy repository (`e:\BlinkOne`)

These are **infrastructure identifiers**, not end-user branding. Rename only if you accept breaking Docker/network contracts.

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `docker-compose.yml` | 63–64 | `chatwoot:` service, `chatwoot/chatwoot:v4.13.0-ce` | Keep service name; image via `CHATWOOT_IMAGE` | Internal DNS hostname |
| `docker-compose.yml` | 18, 73 | DB name `chatwoot` | Keep DB name | Changing requires migration |
| `.env.example` | 7–9 | Comment "Chatwoot (BlinkOne core)" | OK | Documentation only |
| `.env.example` | 9 | `CHATWOOT_IMAGE=chatwoot/chatwoot:...` | Keep image repo path | Upstream image name |
| `nginx/nginx.conf` | 42, 61, 72 | Comments "Chatwoot" | "BlinkOne core" in comments | Optional |
| `gateway/src/index.js` | 101–108 | Routes `/api/chatwoot`, upstream `chatwoot:3000` | Keep | API compatibility |
| `INSTALLATION_NAME` (runtime) | — | Set via `.env` → **BlinkOne** | Already supported | Wave A — verify in Super Admin |

**Already rebranded (Prompt 2):** `public/blinkone-brand/*`, `config/blinkone/branding.yml`, `/blinkone/api/v1/branding`.

---

## Part B — Upstream Chatwoot CE (v4.13.0)

### 1. Visible UI strings — dashboard i18n

**Path:** `app/javascript/dashboard/i18n/locale/<locale>/*.json`  
**Total:** ~1,961 lines containing `Chatwoot` across **55+ locales** (~25–40 strings per locale).

#### English (`en`) — representative rows

| File | Line | Current string | Proposed BlinkOne replacement | Notes |
|------|------|----------------|------------------------------|-------|
| `locale/en/login.json` | 3 | `Login to Chatwoot` | `Login to BlinkOne` | Or `useBranding` / override key |
| `locale/en/signup.json` | 4 | `Get started with Chatwoot` | `Get started with BlinkOne` | Onboarding |
| `locale/en/resetPassword.json` | 4 | `...log in to Chatwoot...` | `...log in to BlinkOne...` | |
| `locale/en/settings.json` | 40 | `...your Chatwoot dashboard` | `...your BlinkOne workspace` | |
| `locale/en/settings.json` | 614 | `...any Chatwoot accounts` | `...any BlinkOne workspaces` | |
| `locale/en/integrations.json` | 20 | `Chatwoot integrates with...` | `BlinkOne integrates with...` | Long copy |
| `locale/en/inboxMgmt.json` | 1126 | `BRANDING_TEXT: Powered by Chatwoot` | `Powered by BlinkOne` or partner string | Widget-related copy in dashboard |
| `locale/en/generalSettings.json` | 126–130 | Update/payment copy mentions Chatwoot | BlinkOne + LABBIK support URL | Cloud-oriented strings — hide on self-hosted |
| `locale/en/yearInReview.json` | 51–52 | `...with Chatwoot` / `Made with Chatwoot` | BlinkOne equivalents | |
| `locale/en/labelsMgmt.json` | 53 | `Chatwoot AI` | `BlinkOne AI` | Sidecar feature name |
| `locale/en/auditLogs.json` | 9, 13 | `Chatwoot System` | `BlinkOne platform` | |

**High-traffic locale files (all locales):** `login.json`, `signup.json`, `resetPassword.json`, `settings.json`, `integrations.json`, `inboxMgmt.json`, `generalSettings.json`, `helpCenter.json`, `yearInReview.json`, `mfa.json`, `auditLogs.json`, `conversation.json`, `labelsMgmt.json`.

#### Arabic (`ar`) — RTL check required

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `locale/ar/login.json` | 3 | `تسجيل الدخول إلى Chatwoot` | `تسجيل الدخول إلى BlinkOne` | Verify RTL layout on login |
| `locale/ar/signup.json` | 4 | English leftover: `Get started with Chatwoot` | Arabic + BlinkOne | Several `ar` files still English |
| `locale/ar/integrations.json` | 20+ | Mixed AR/EN with "Chatwoot" | Full Arabic pass | |

**Strategy:** Wave C — add `app/javascript/dashboard/i18n/locale/<locale>/blinkone_overrides.json` merged after core loader (do not fork 1,961 lines in place).

---

### 2. Visible UI strings — widget i18n

**Path:** `app/javascript/widget/i18n/locale/*.json`  
**Total:** 54 files (one per locale), typically **1 string each**.

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `widget/i18n/locale/en.json` | 60 | `POWERED_BY: Powered by Chatwoot` | `Powered by BlinkOne` (confirm legal wording) | CE attribution — confirm with LABBIK |
| All `widget/i18n/locale/*.json` | 60 | Same pattern | Locale-specific BlinkOne string | 54 locales |

**Widget runtime:** Brand URL from `WIDGET_BRAND_URL` / installation config (Wave A).

---

### 3. Portal / help center i18n

**Path:** `app/javascript/portal/` (Vue) + `app/views/layouts/portal.html.erb`  
**Note:** No `portal/i18n` tree; portal copy lives in dashboard `helpCenter.json` and portal templates.

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `dashboard/i18n/locale/en/helpCenter.json` | 730 | Placeholder `User Guide \| Chatwoot` | `User Guide \| BlinkOne` | Wave C |
| `layouts/portal.html.erb` | 37 | `@portal.display_title` | Tenant-controlled | Usually OK |

---

### 4. Email template strings

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `app/views/devise/mailer/confirmation_instructions.html.erb` | 6, 10, 14 | `'Chatwoot'` fallback in `BRAND_NAME` | Uses `global_config['BRAND_NAME']` → set **BlinkOne** | Wave A + D |
| `app/views/mailers/.../account_deletion_for_inactivity.liquid` | 3, 7, 17–19 | Multiple "Chatwoot" + `hello@chatwoot.com` | BlinkOne + `noreply@blinkone.ai` | Wave D — Liquid overrides |
| `app/views/mailers/.../account_deletion_user_initiated.liquid` | 3, 14 | `Chatwoot account` / `Chatwoot Team` | BlinkOne | |
| `app/views/mailers/.../account_deleted.liquid` | 3, 6, 30 | `Chatwoot instance` / `Chatwoot System` | BlinkOne | |
| `app/views/mailers/conversation_reply_mailer/*.erb` | 4, 16, 33 | `ChatwootMarkdownRenderer` | **Keep class name** | Code, not visible |

**Mailer layout:** Inject `app/views/layouts/mailer_blinkone.html.erb` (Wave D) — do not edit upstream ERBs in place.

---

### 5. HTML metadata

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `public/manifest.json` | 2–3 | `"name": "Chatwoot"` | `"BlinkOne"` | Wave A — or dynamic manifest |
| `public/manifest.json` | 42–43 | `theme_color: #1f93ff` | `#0B5FFF` (BlinkOne primary) | Brand token |
| `public/browserconfig.xml` | — | MS tile icons only | Swap icon paths | Wave B |
| `app/views/layouts/vueapp.html.erb` | 4–6 | `<title><%= INSTALLATION_NAME %></title>` | Set `INSTALLATION_NAME=BlinkOne` | Wave A — already env-driven |
| `app/views/layouts/vueapp.html.erb` | 12 | Meta description template | Customize via installation config | |
| `app/views/layouts/vueapp.html.erb` | 16–29 | `/favicon-*.png`, `/apple-icon-*.png` | `/blinkone-brand/favicon-32.png` etc. | Wave B |
| `app/views/layouts/vueapp.html.erb` | 34 | `window.chatwootConfig` | **Keep property name** | JS API stability |

---

### 6. Logo / image references

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `config/installation_config.yml` | 21–32 | `LOGO`, `LOGO_DARK`, `LOGO_THUMBNAIL` → `/brand-assets/*.svg` | `/blinkone-brand/logo-full.svg` etc. | Wave A + B |
| `public/brand-assets/logo.svg` | — | Chatwoot logo | Replace with BlinkOne assets | Wave B |
| `public/brand-assets/logo_dark.svg` | — | Chatwoot dark logo | `logo-full-dark.svg` | |
| `public/brand-assets/logo_thumbnail.svg` | — | Thumbnail | `logo-mark.svg` | |
| `app/javascript/v3/views/auth/signup/Index.vue` | 13–14 | `installationName === 'Chatwoot'` | Changes when `INSTALLATION_NAME` ≠ Chatwoot | Shows custom signup when rebranded |
| `app/javascript/shared/composables/useBranding.js` | 20 | `.replace(/Chatwoot/g, installationName)` | Already helps if INSTALLATION_NAME set | Partial auto-rebrand |

---

### 7. Favicons & static icons

| Asset path | Proposed replacement |
|------------|---------------------|
| `public/favicon-16x16.png`, `favicon-32x32.png`, `favicon-96x96.png` | `public/blinkone-brand/favicon-*.png` |
| `public/apple-icon-*.png` (multiple sizes) | `public/blinkone-brand/apple-touch-icon.png` + generated set |
| `public/android-icon-*.png` | Generate from BlinkOne mark |
| `public/ms-icon-*.png` | `browserconfig.xml` + new tiles |

---

### 8. Loading screen & layouts

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `app/views/layouts/vueapp.html.erb` | — | SPA shell; title from config | BlinkOne | No separate `public/index.html` for dashboard |
| Widget embed | `public/packs/widget` (built) | Loaded from Rails | Rebrand via widget i18n + CSS vars | |

---

### 9. Static error pages

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `public/404.html` | 6 | `Page not found` (generic) | Add BlinkOne logo + link home | No "Chatwoot" text today; still rebrand visuals (Wave B) |
| `public/422.html`, `public/500.html` | — | Same pattern | BlinkOne styled errors | Verify exist |

---

### 10. Marketing & external redirects

| File | Line | Current URL | Proposed | Notes |
|------|------|-------------|----------|-------|
| `config/installation_config.yml` | 34, 38 | `https://www.chatwoot.com` | `https://blinkone.ai` | `BRAND_URL`, `WIDGET_BRAND_URL` |
| `config/installation_config.yml` | 46, 50 | chatwoot.com terms/privacy | LABBIK terms/privacy URLs | |
| `app/javascript/shared/constants/links.js` | 11 | `https://hub.2.chatwoot.com/changelogs` | Disable or BlinkOne changelog | Self-hosted: hide update UI |
| Mailer liquid | — | `hello@chatwoot.com` | `support@blinkone.ai` | |

**Social / Twitter:** No hardcoded `@chatwoot` in user-facing dashboard `en` i18n (verify per locale in Wave C).

---

### 11. Seeded installation config (`config/installation_config.yml`)

| Key | Default value | Proposed BlinkOne value | Wave |
|-----|---------------|-------------------------|------|
| `INSTALLATION_NAME` | `Chatwoot` | `BlinkOne` | A |
| `BRAND_NAME` | `Chatwoot` | `BlinkOne` | A |
| `BRAND_URL` | `https://www.chatwoot.com` | `https://blinkone.ai` | A |
| `WIDGET_BRAND_URL` | `https://www.chatwoot.com` | `https://blinkone.ai` | A |
| `LOGO` | `/brand-assets/logo.svg` | `/blinkone-brand/logo-full.svg` | A/B |
| `LOGO_DARK` | `/brand-assets/logo_dark.svg` | `/blinkone-brand/logo-full-dark.svg` | A/B |
| `LOGO_THUMBNAIL` | `/brand-assets/logo_thumbnail.svg` | `/blinkone-brand/logo-mark.svg` | A/B |
| `TERMS_URL` | chatwoot.com/terms | `branding.yml` `terms_url` | A |
| `PRIVACY_URL` | chatwoot.com/privacy | `branding.yml` `privacy_url` | A |
| `DISPLAY_MANIFEST` | `true` | `true` (BlinkOne manifest) | A |
| `MAILER_SENDER_EMAIL` | (see file) | `noreply@blinkone.ai` | A |

**Also set in BlinkOne `.env`:** `INSTALLATION_NAME`, `MAILER_SENDER_EMAIL`, `FRONTEND_URL`, `DISABLE_TELEMETRY=true`.

---

### 12. In-app documentation & help links

| Area | Finding | Proposed |
|------|---------|----------|
| Dashboard settings copy | References to Chatwoot docs in `integrations.json` sidebar HTML | Replace with BlinkOne docs URL |
| MFA cloud support | `reach out to Chatwoot support` | LABBIK support |
| `generalSettings.json` | Version upgrade nags | Disable via self-hosted hub / env |

---

### 13. Widget — "Powered by" badge

| File | Key | Current | Proposed | Notes |
|------|-----|---------|----------|-------|
| `widget/i18n/locale/en.json` | `POWERED_BY` | `Powered by Chatwoot` | **`Powered by BlinkOne`** (confirm) | CE license still requires attribution |
| Widget brand link | `WIDGET_BRAND_URL` config | chatwoot.com | blinkone.ai | |

**Confirm with LABBIK:** Exact CE attribution wording (Chatwoot MIT attribution vs full white-label).

---

### 14. Onboarding / signup

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `app/javascript/v3/views/auth/signup/Index.vue` | 13–18 | Detects default `Chatwoot` install to show cloud signup | After rebrand, `isAChatwootInstance` false → custom BlinkOne signup | Intended |
| `dashboard/i18n/locale/en/signup.json` | 4 | `Get started with Chatwoot` | BlinkOne | Wave C |

---

### 15. Webhooks & API headers (outbound)

| File | Line | Current | Proposed | Notes |
|------|------|---------|----------|-------|
| `lib/webhooks/trigger.rb` | 46–50 | `X-Chatwoot-Delivery`, `X-Chatwoot-Signature` | **Keep** for integrators expecting Chatwoot format | Or document BlinkOne alias headers |
| `lib/webhooks/trigger.rb` | — | No `User-Agent: Chatwoot/x.y.z` in v4.13.0 | N/A | Prompt outdated; uses signature headers |

**Inbound webhooks (BlinkOne gateway):** `x-chatwoot-signature` — keep for compatibility.

---

### 16. Out of scope — do NOT rebrand (internal)

| Pattern | Examples | Reason |
|---------|----------|--------|
| Module/class names | `ChatwootHub`, `ChatwootMarkdownRenderer`, `ChatwootExceptionTracker` | Breaking changes, not user-visible |
| JS globals | `window.chatwootConfig`, `chatwootSDK` | Widget embed API contract |
| DB/service names | `chatwoot` postgres DB, docker service `chatwoot` | Operations |
| Webhook header names | `X-Chatwoot-*` | Third-party integrations |
| `enterprise/` tree | All files | **License block** — never touch |
| Test fixtures/specs | `@chatwoot.com` emails in specs | Test data only |

---

## Part C — Proposed 4-wave execution plan (for approval)

| Wave | Scope | Risk | BlinkOne method |
|------|--------|------|-----------------|
| **A — Infrastructure** | `installation_config.yml` seeds, `.env`, Super Admin values, `DISABLE_TELEMETRY`, manifest title/colors | Low | Env + Super Admin UI; no fork |
| **B — Visual assets** | Logos, favicons, splash, 404/500 pages, `public/brand-assets` | Low | `public/blinkone-brand/` + config URLs |
| **C — i18n strings** | Dashboard + widget locales | Medium | `blinkone_overrides.json` loader per locale; English + **Arabic (`ar`)** first |
| **D — Email** | Mailer Liquid + Devise | Medium | `mailer_blinkone` layout + view path injection |

**After each wave:** Full test suite (when fork exists), staging smoke test, screenshots → `docs/blinkone/REBRAND_PROGRESS.md`.

### Arabic / RTL (Oman)

- [ ] Login, dashboard home, conversation view in `ar` locale  
- [ ] Widget embed with `locale=ar`  
- [ ] Logo mark not clipped in RTL header  
- [ ] Mixed EN/AR strings in `ar/*.json` cleaned in Wave C  

---

## Part D — Docker-only deploy (current BlinkOne repo)

Until a Chatwoot fork exists, only **Wave A + B** are fully achievable:

1. Set installation config via Rails console or Super Admin after boot.  
2. Serve `/blinkone-brand/*` via nginx (done).  
3. Widget/dashboard strings still show upstream defaults until Wave C loader is shipped in a fork or custom image build.

**Recommended:** Add `chatwoot-fork` submodule or build custom image `blinkone/chatwoot:v4.13.0-ce-b1` with overlay from `chatwoot-fork-overlay/`.

---

## Sign-off checklist (Prompt 3)

- [x] Discovery complete — inventory documented  
- [ ] Stakeholder approval of 4-wave plan  
- [ ] "Powered by" legal wording confirmed  
- [ ] Webhook header rename decision (keep `X-Chatwoot-*` vs `X-BlinkOne-*`)  
- [ ] Begin Wave A execution  

---

*Regenerate JSON inventory: `python scripts/blinkone/scan-rebrand-inventory.py` (requires `.upstream-inventory/chatwoot` clone).*
