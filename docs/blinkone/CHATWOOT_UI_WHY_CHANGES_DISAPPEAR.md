# Why Chatwoot UI changes “disappear”

BlinkOne does **not** mount Vue source into the running container. The dashboard is **compiled into the Docker image** at build time. If the UI looks like plain Chatwoot again, it is almost always one of the causes below.

## 1. Wrong Docker image (most common)

`docker-compose.yml` uses:

```bash
CHATWOOT_IMAGE=${CHATWOOT_IMAGE:-blinkone/chatwoot:v4.13.0-ce-b1}
```

If `.env` sets **`CHATWOOT_IMAGE=chatwoot/chatwoot:v4.13.0-ce`**, you get **upstream Chatwoot with no BlinkOne overlay** (no Chats|Calls tabs, no BlinkOne settings, etc.).

**Fix:**

```bash
# .env
CHATWOOT_IMAGE=blinkone/chatwoot:v4.13.0-ce-b1
```

Then rebuild and restart:

```powershell
.\scripts\blinkone\build-chatwoot-image.ps1
docker compose up -d chatwoot sidekiq
```

## 2. Overlay changed on disk but image not rebuilt

Frontend lives in `chatwoot-fork-overlay/`. The Dockerfile copies it and runs `rake assets:precompile`. **Restarting the container is not enough** after editing `.vue` files.

**Fix:** run a full image build (see above). Hard-refresh the browser (Ctrl+F5).

## 3. `chatwoot-fork-overlay/` not committed to Git

As of the last check, **`chatwoot-fork-overlay/` was untracked** (`git status` shows `??`). That means:

- `git clean`, fresh clone, or another PC → **all UI work is missing from the repo**
- Only the last built Docker image on one machine still has the UI

**Fix:** commit the overlay:

```bash
git add chatwoot-fork-overlay/ scripts/blinkone/patch-chatwoot-*.mjs
git commit -m "Add Chatwoot BlinkOne overlay and calling inbox UI"
```

## 4. Edits only inside the running container

Changes made with `docker compose exec chatwoot` under `/app/` are **lost** when the container is recreated (`up -d`, pull, rebuild).

**Fix:** always edit files under `chatwoot-fork-overlay/` in the repo, then rebuild the image.

## 5. Lightweight `Dockerfile.nobuild` without a new asset build

`Dockerfile.nobuild` copies overlay files but **does not** run `assets:precompile`. New Vue components may not appear in the browser bundle.

**Fix:** use the main `docker/chatwoot-blinkone/Dockerfile` via `docker compose build chatwoot`, or accept that nobuild is overlay-only (Ruby/views), not full dashboard JS.

## 6. Browser cache

Old `packs/js/dashboard-*.js` may be cached.

**Fix:** Ctrl+F5 or incognito window.

---

## Quick checklist

| Check | Command / location |
|--------|-------------------|
| Overlay on disk | `dir chatwoot-fork-overlay\app\javascript\dashboard\blinkone_components` |
| Image tag in use | `docker inspect blinkone-chatwoot-1 --format "{{.Config.Image}}"` |
| Should be | `blinkone/chatwoot:v4.13.0-ce-b1` |
| Patch in image | `docker compose exec chatwoot grep CallsInboxTabs /app/app/javascript/dashboard/components/ChatList.vue` |
| Rebuild | `.\scripts\blinkone\build-chatwoot-image.ps1` |

## Source of truth

| What | Where |
|------|--------|
| Vue / i18n overlay | `chatwoot-fork-overlay/` |
| Inbox patches (Calls tab, etc.) | `scripts/blinkone/patch-chatwoot-calling-inbox.mjs` (run at **image build**) |
| Image recipe | `docker/chatwoot-blinkone/Dockerfile` |
