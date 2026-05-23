# Telephony admin in Chatwoot (not admin-panels)

BlinkOne telephony administration lives **inside the Chatwoot dashboard** under **Settings**.

## Where to find it

| Feature | Path |
|---------|------|
| IVR flows | **Settings → IVR flows** (`/app/accounts/{accountId}/settings/blinkone/ivr`) |
| Call routing | **Settings → Call routing (ACD)** (`/app/accounts/{accountId}/settings/blinkone/routing`) |

Legacy URLs redirect into Chatwoot:

- `/blinkone/admin/ivr` → account IVR settings
- `/blinkone/admin/routing` → account routing settings
- `/admin` → `/app/` (static admin-panels retired)

## Rebuild required

Telephony UI is in `chatwoot-fork-overlay/`. Rebuild the Chatwoot image after changes:

```powershell
docker compose build chatwoot
docker compose up -d chatwoot nginx
```

The Dockerfile runs `scripts/blinkone/patch-chatwoot-telephony.mjs` to register routes and sidebar entries in upstream Chatwoot CE.

## API auth

`vueapp.html.erb` injects `window.chatwootConfig.blinkone.ivrToken` and `routingToken` from `IVR_TOKEN` / `ROUTING_TOKEN` in `.env` (also set on the `chatwoot` service in compose).

Tenant id for sidecars = **Chatwoot account id** (`route.params.accountId`).

## Source layout

```
chatwoot-fork-overlay/app/javascript/
  dashboard/blinkone_components/telephony/ivr/Index.vue
  dashboard/blinkone_components/telephony/routing/Index.vue
  dashboard/routes/dashboard/settings/blinkone/*.routes.js
  shared/blinkone/useBlinkoneApi.js
```

`admin-panels/` is **deprecated** — do not extend it for new features.
