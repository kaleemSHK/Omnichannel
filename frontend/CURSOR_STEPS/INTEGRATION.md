# Frontend ↔ Chatwoot + Gateway Integration

Connect the Next.js agent UI (`http://127.0.0.1:3001`) to real backends.

## Architecture

```
Browser http://127.0.0.1:3001
  ├─ /_cw/*  →  Chatwoot  http://127.0.0.1:3000
  └─ /_gw/*  →  Gateway   http://127.0.0.1:8080  (nginx → gateway:8787)
```

Auth flow: Chatwoot `POST /auth/sign_in` → gateway `POST /api/auth/token` → store both tokens.

## 1. Start Docker

```powershell
cd e:\BlinkOne
copy .env.example .env
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d `
  postgres postgres_app redis chatwoot sidekiq gateway nginx `
  platform tickets calls ai billing sla escalation routing ivr tenant
```

Publish Chatwoot on host `:3000` (required for Next.js `/_cw` rewrites):

```yaml
# docker-compose.yml → chatwoot:
ports: ["3000:3000"]
```

Gateway is exposed via staging nginx on `:8080`.

## 2. Verify backends

```powershell
curl -I http://127.0.0.1:3000/auth/sign_in
curl -I http://127.0.0.1:8080/api/auth/token
```

## 3. Frontend env (`frontend/.env.local`)

| Variable | Integrated value |
|----------|------------------|
| `NEXT_PUBLIC_USE_DEMO_DATA` | `false` |
| `CHATWOOT_UPSTREAM` | `http://127.0.0.1:3000` |
| `GATEWAY_UPSTREAM` | `http://127.0.0.1:8080` |
| `NEXT_PUBLIC_WS_URL` | `ws://127.0.0.1:3000/cable` |

Demo mode: set `NEXT_PUBLIC_USE_DEMO_DATA=true` — no backends required.

## 4. Run frontend

```powershell
cd frontend
npm run dev
```

Login at http://127.0.0.1:3001/login

## Services per screen

| Screen | Required services |
|--------|-------------------|
| Login | Chatwoot, gateway |
| Conversations | Chatwoot (+ ActionCable on :3000) |
| Contacts | Chatwoot |
| Reports | Chatwoot |
| Settings | Chatwoot |
| Calling | gateway, calls, routing |
| SLA | gateway, sla |
| Escalation | gateway, escalation |
| Billing | gateway, billing |
| Tickets | gateway, tickets |
| AI / Knowledge | gateway, ai |
| Platform | gateway, platform, tenant |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty sidebar after login | Log out/in; Chatwoot `administrator` maps to BlinkOne `admin` |
| 401 on `/_gw/*` | Log in first; ensure `USE_DEMO_DATA=false` and gateway JWT is stored |
| 404 on send message | Use real Chatwoot conversations, not demo fixture IDs (42, 55, 61) |
| CORS errors | Use `/_cw` and `/_gw` proxy paths, not raw `:3000` URLs in browser |
| WS connection fails | Use `ws://127.0.0.1:3000/cable` (or `ws://127.0.0.1:8080/cable` via nginx) |
| Chatwoot unreachable | Publish `ports: ["3000:3000"]` on the chatwoot service |
