# Rebrand progress

| Wave | Status | Notes |
|------|--------|-------|
| A — Infrastructure | Ready | `rake blinkone:apply_branding`, env vars, `DISABLE_TELEMETRY` |
| B — Visual assets | Ready | `public/blinkone-brand/`, overlay `brand-assets/`, `manifest.json`, `404.html` |
| C — i18n | Ready (build) | `blinkoneMergeLocales.js` + widget merge; requires **custom image build** |
| D — Email | Ready (build) | `mailer/blinkone_base.liquid`, Liquid overrides, initializer |

## Deploy rebranded Chatwoot

### Build the image (needs ~10 GB Docker RAM)

Vite compiles the dashboard and needs a large Node heap. In Docker Desktop: **Settings → Resources → Memory ≥ 10 GB**.

```powershell
# Windows
.\scripts\blinkone\build-chatwoot-image.ps1

# Or manually
$env:DOCKER_BUILDKIT="1"
docker compose build chatwoot
```

If the build fails with `JavaScript heap out of memory`, either increase Docker RAM or use the lightweight image (skips Wave C i18n in JS bundles):

```bash
docker build -f docker/chatwoot-blinkone/Dockerfile.nobuild -t blinkone/chatwoot:v4.13.0-ce-b1-nobuild .
# Set CHATWOOT_IMAGE=blinkone/chatwoot:v4.13.0-ce-b1-nobuild in .env
```

### Run

```bash
docker compose up -d
docker compose exec chatwoot bundle exec rake blinkone:apply_branding
docker compose restart chatwoot sidekiq
```

## Verify

- [ ] Login title: "Login to BlinkOne"
- [ ] Widget badge: "Powered by BlinkOne"
- [ ] Favicon: BlinkOne mark at `/blinkone-brand/favicon-32.png`
- [ ] `curl http://localhost/blinkone/api/v1/branding`
- [ ] Arabic locale (`ar`) login RTL layout
- [ ] Account deletion email uses BlinkOne copy (staging test)

## Screenshots

_Add screenshots to `docs/blinkone/screenshots/` after staging smoke test._
