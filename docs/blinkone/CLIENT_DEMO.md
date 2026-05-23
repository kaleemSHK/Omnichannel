# Client demo — quick start

One command seeds **inbox conversations**, **SLA**, **escalation**, **IVR**, **routing**, and **Business plan** features.

## Prerequisites

```powershell
cd E:\BlinkOne
docker compose up -d
# Wait until chatwoot is healthy (1–2 min after first start)
```

## Seed everything

```powershell
.\scripts\seed-demo.ps1
```

Or:

```powershell
node scripts/seed-client-demo.mjs --tenant-id=1 --plan=business
```

Use `--plan=enterprise` for SSO + WhatsApp calling flags.

## Login for the presentation

| | |
|---|---|
| **URL** | http://127.0.0.1/app/login |
| **Email** | `demo.agent@blinkone.ai` |
| **Password** | `DemoAgent1!` |

Agent name on screen: **Sarah Al-Hinai**.

## What to show the client

1. **Inbox** — 8 Oman telecom-style chats (open, pending, resolved, urgent, VIP labels).
2. **Settings → BlinkOne → SLA** — Gold / Silver / Bronze policies.
3. **Settings → BlinkOne → Escalations** — rules for SLA warning/breach.
4. **Settings → BlinkOne → IVR / Routing** — demo flow + Sales/Support queues.
5. **Calling** (if PSTN enabled) — Chats \| Calls tabs, softphone in settings.

## Demo narrative (2–3 min)

- *"Unified inbox for WhatsApp, web chat, and voice — one agent workspace."*
- *"SLA by priority — urgent Muscat outage hits Gold 15-minute first response."*
- *"Escalation auto-labels and bumps priority on breach."*
- *"IVR and ACD queues for sales vs support — built for Gulf operators."*

## Re-seed / reset

```powershell
docker compose exec chatwoot bundle exec rails runner "Account.find(1).conversations.destroy_all"
.\scripts\seed-demo.ps1
```

## Enterprise plan demo

```powershell
node scripts/seed-client-demo.mjs --tenant-id=1 --plan=enterprise
```

Then re-apply tenant SQL or use Settings → Platform to enable SSO / WhatsApp calling flags.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 on login | Wait for Chatwoot boot; set `FRONTEND_URL=http://127.0.0.1` in `.env`, `docker compose up -d chatwoot` |
| SLA seed fails | `docker compose up -d sla escalation postgres_app` then re-run seed |
| No tenant features | `docker compose logs tenant billing` — ensure `APP_DB_PASSWORD` in `.env` |

See also [DEMO_DATA.md](./DEMO_DATA.md).
