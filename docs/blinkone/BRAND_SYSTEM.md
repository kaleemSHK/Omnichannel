# BlinkOne brand token system (Prompt 2)

## Source of truth

`config/blinkone/branding.yml` — defaults + per-tenant overrides (`tenants."<chatwoot_account_id>"`).

## Runtime (this repo)

| Layer | Location |
|-------|----------|
| API | `GET/PATCH /blinkone/api/v1/branding` → platform → gateway → nginx |
| Assets | `/blinkone-brand/*` static; uploads at `/blinkone-brand/uploads/<accountId>/` |
| Admin UI | Chatwoot Settings (`blinkone_components/`); branding via `useBrand()` |

Auth for `PATCH` / asset upload: `Authorization: Bearer <PLATFORM_TOKEN>`.

## Chatwoot fork (overlay)

Copy `chatwoot-fork-overlay/` paths into a Chatwoot CE fork:

- `lib/blinkone/branding.rb` + `config/initializers/blinkone_branding.rb`
- `app/javascript/shared/blinkone/useBrand.js` + `blinkoneBrandStore.js`
- SCSS tokens + Tailwind snippet
- `Blinkone::Api::V1::BrandingController` when Rails hosts the API instead of platform

## Tests

```bash
# Ruby
cd spec && bundle install && bundle exec rspec

# Vue helpers
cd chatwoot-fork-overlay && npm install && npm test
```

## Step 7 (deferred)

Dashboard logo wiring (`useBrand().logoUrl('full')`) waits for approval after steps 1–6 — see Prompt 3 rebrand pass.
