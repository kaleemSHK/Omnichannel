# BlinkOne UI redesign — reverted

The Respond.io + Notion inbox shell (`doc/BLINKONE_UI_REDESIGN_PROMPT.md`) and Respond.io exact spec have been **reverted**. The dashboard uses stock Chatwoot CE v4.13 layout and styling again.

## What was removed

- `scripts/blinkone/patch-chatwoot-redesign.mjs` (no longer run in `docker/chatwoot-blinkone/Dockerfile`)
- `assets/scss/blinkone/*` (tokens, Respond.io / Option B overrides)
- Shell: `BlinkOneLayout`, `BlinkOneIconRail`, `BlinkOneSidebar`
- Custom inbox list / conversation chrome under `blinkone_components/conversations/`
- Branded `EmptyStateMessage.vue` overlay (upstream Chatwoot empty state restored on rebuild)

## What remains

- BlinkOne **rebrand** (i18n, logos, `useBrand()`, mailers) via overlay + `blinkone_branding` initializer
- **Telephony / admin** Vue routes under `blinkone_components/telephony/`, `admin/`, `platform/`, etc.
- `scripts/blinkone/patch-chatwoot-telephony.mjs` (settings routes only)

## Restore stock UI after a prior redesign build

```powershell
docker compose build chatwoot
docker compose up -d chatwoot
```

Hard-refresh the browser (Ctrl+Shift+R). You should see Chatwoot’s default **NextSidebar** inbox, not the custom rail/sidebar.

## Re-enable later

Keep `doc/BLINKONE_UI_REDESIGN_PROMPT.md` as the design reference only. Re-implementation would require re-adding overlay assets and a new patch script.
