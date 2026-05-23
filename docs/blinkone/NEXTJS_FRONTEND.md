# BlinkOne Next.js frontend

Agent UI on **port 80**. Chatwoot Vue UI on **port 3000**. BlinkOne API gateway (nginx) on **port 8080**.

## URLs

| URL | Purpose |
|-----|---------|
| `http://127.0.0.1/login` | Next.js agent sign-in |
| `http://127.0.0.1/conversations` | Mock-aligned inbox |
| `http://127.0.0.1:3000/app/login` | Legacy Chatwoot Vue UI |
| `http://127.0.0.1:8080/api/...` | Gateway + sidecars |

Set in root `.env`:

- `FRONTEND_URL=http://127.0.0.1:3000` — Chatwoot redirects and mail links
- `BLINKONE_AGENT_URL=http://127.0.0.1` — Next.js UI (port 80)
- `BLINKONE_API_URL=http://127.0.0.1:8080` — gateway proxy

Rebuild after changing public URLs:

```powershell
docker compose build blinkone-frontend
docker compose up -d blinkone-frontend chatwoot nginx
```

## Local dev (no Docker)

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

`npm run dev` uses port **3001** (avoids needing admin rights for port 80 on Windows). Open `http://127.0.0.1:3001/login`. Ensure Chatwoot is on `:3000` and nginx on `:8080` (or adjust `.env.local`).

## Demo login

Same Chatwoot agent as the Vue overlay (after `.\scripts\seed-demo.ps1`):

- `demo.agent@blinkone.ai` / `DemoAgent1!`
