# PROMPT 25 — Final Demo Readiness
## BlinkOne · Full Client Demo Checklist · blinksone.com

This is the **definitive final prompt** to bring BlinkOne to a fully live, demo-ready state.
It is split into two zones:

- **Zone 1 — Local (Cursor)**: code changes you run from your laptop inside Cursor
- **Zone 2 — Server (SSH)**: shell commands you run on `root@204.168.137.104`

Run all blocks in order. Each section has a ✅ verification step — don't skip them.

---

## ZONE 1 — LOCAL CODE CHANGES (run in Cursor)

### STEP 1 — Fix `.gitignore` (stop pushing build cache to GitHub)

The `.next/` build directory (73 MB cache files) is being committed to GitHub.
Add it to the root `.gitignore`:

```bash
# From your local E:\BlinkOne directory in PowerShell:
Add-Content E:\BlinkOne\.gitignore "`nfrontend/.next/`nfrontend/node_modules/"
```

Or manually open `E:\BlinkOne\.gitignore` and add these two lines at the end:

```
frontend/.next/
frontend/node_modules/
```

Then remove the already-tracked cache from git (does NOT delete files, just stops tracking):

```bash
cd E:\BlinkOne
git rm -r --cached frontend/.next/ 2>$null; git rm -r --cached frontend/node_modules/ 2>$null
git status
```

---

### STEP 2 — Wire Twilio SIP into frontend `.env.production`

**You need these 4 values from your Twilio Elastic SIP Trunk before doing this step.**

From Twilio Console (https://console.twilio.com):

| Item | Where to find | Example |
|------|---------------|---------|
| Termination URI | Elastic SIP Trunks → your trunk → Termination | `demo.pstn.twilio.com` |
| Your DID (phone number) | Phone Numbers → Active Numbers | `+12125551234` |
| SIP Username | Elastic SIP Trunks → Credential Lists | (you created one) |
| SIP Password | Elastic SIP Trunks → Credential Lists | (you created one) |

> **If you don't have Twilio credentials yet:** skip this step and the calling widget
> will stay in demo/simulation mode (still looks great for a UI demo). Come back
> to this step when you have the credentials.

**When you have credentials**, open `E:\BlinkOne\frontend\.env.production`
and set these 4 values:

```env
# Replace with your real Twilio values:
NEXT_PUBLIC_SIP_WSS=wss://sip.twilio.com:5061
NEXT_PUBLIC_SIP_DOMAIN=demo.pstn.twilio.com
NEXT_PUBLIC_SIP_USER=your_twilio_credential_list_username
NEXT_PUBLIC_SIP_PASS=your_twilio_credential_list_password
```

> **Note:** `isSipReady()` in `src/lib/env/telephony.ts` checks that SIP_WSS is a valid
> `wss://` URL and SIP_PASS is not empty. If both are set correctly, the JsSIP UA will
> auto-register and calling will be live.

---

### STEP 3 — Verify demo/real data toggle

The app uses `NEXT_PUBLIC_USE_DEMO_DATA` to switch between mock data and real API calls.
Make sure the production env file has it set correctly:

Open `E:\BlinkOne\frontend\.env.production` and confirm this line exists:

```env
NEXT_PUBLIC_USE_DEMO_DATA=false
```

If it says `true`, change it to `false`. This ensures the live server shows real
Chatwoot conversations and tickets instead of mock data.

---

### STEP 4 — Commit and push everything to GitHub

```bash
cd E:\BlinkOne

# Stage all changes
git add -A

# Commit
git commit -m "fix: gitignore .next build cache, wire Twilio SIP env vars"

# Push to main
git push origin main
```

Expected: push succeeds, no 73 MB cache files this time.

✅ **Verify**: Go to https://github.com/kaleemSHK/Omnichannel — the `frontend/.next/` folder
should NOT appear in the file tree.

---

## ZONE 2 — SERVER COMMANDS (SSH into root@204.168.137.104)

Connect via SSH:
```bash
ssh root@204.168.137.104
```

If you lost SSH access (server requires key), use the **Hetzner web console**:
Go to https://console.hetzner.cloud → your server → click `>_` icon.

---

### STEP 5 — Fix Nginx: `underscores_in_headers on`

Without this, Nginx strips the `api_access_token` header → Chatwoot returns 401 →
Conversations page is empty even after login.

```bash
# Check current config
grep -n "underscores_in_headers" /etc/nginx/sites-available/blinkone

# If NOT found, add it inside the HTTPS server block:
sed -i '/listen 443 ssl;/a\    underscores_in_headers on;' /etc/nginx/sites-available/blinkone

# Verify it was added
grep -n "underscores_in_headers" /etc/nginx/sites-available/blinkone

# Test and reload
nginx -t && systemctl reload nginx
echo "✅ Nginx reloaded"
```

---

### STEP 6 — Pull latest code from GitHub

```bash
cd /opt/blinkone/frontend
git pull origin main
echo "✅ Code updated"
```

---

### STEP 7 — Start postgres_app and all backend services

The tickets, SLA, escalation, routing, and calls services all depend on `postgres_app`.

```bash
cd /opt/blinkone

# Start postgres_app first
docker compose up -d postgres_app
sleep 15

# Verify it's healthy
docker compose ps postgres_app

# Start all remaining services
docker compose up -d tickets sla escalation routing calls

# Wait for startup
sleep 30

# Check all containers
docker compose ps
```

**Expected — all containers `Up` or `healthy`:**
```
blinkone-postgres-1       Up (healthy)
blinkone-postgres_app-1   Up (healthy)
blinkone-redis-1          Up (healthy)
blinkone-chatwoot-1       Up
blinkone-sidekiq-1        Up
blinkone-gateway-1        Up
blinkone-tickets-1        Up
blinkone-sla-1            Up
blinkone-escalation-1     Up
blinkone-routing-1        Up
blinkone-calls-1          Up
```

If any shows `Restarting` or `Exit`, check its logs:
```bash
docker logs blinkone-tickets-1 --tail 40
docker logs blinkone-sla-1 --tail 40
docker logs blinkone-escalation-1 --tail 40
```

---

### STEP 8 — Expose service ports via docker-compose.override.yml

> **Skip if you already ran Part C of PROMPT_24** — the override file already exists.

```bash
# Check if it already has port bindings
grep -c "ports" /opt/blinkone/docker-compose.override.yml 2>/dev/null && echo "Already set" || cat > /opt/blinkone/docker-compose.override.yml << 'EOF'
services:
  chatwoot:
    image: chatwoot/chatwoot:v4.13.0-ce
    build: !reset null
  sidekiq:
    image: chatwoot/chatwoot:v4.13.0-ce
    build: !reset null

  gateway:
    ports:
      - '127.0.0.1:8787:8787'

  tickets:
    ports:
      - '127.0.0.1:8791:8791'

  sla:
    ports:
      - '127.0.0.1:8796:8796'

  escalation:
    ports:
      - '127.0.0.1:8797:8797'

  routing:
    ports:
      - '127.0.0.1:8798:8798'
EOF

# Restart to pick up port bindings
cd /opt/blinkone
docker compose up -d gateway tickets sla escalation routing
sleep 15
echo "✅ Port bindings applied"
```

---

### STEP 9 — Seed Demo Data into Chatwoot (12 contacts + conversations)

> **Skip if you already ran Part D of PROMPT_24** — conversations already exist.

```bash
cd /opt/blinkone

docker compose exec chatwoot bundle exec rails runner "
account = Account.first
inbox = Inbox.find_by(name: 'WhatsApp Support', account: account) || Inbox.create!(
  account: account,
  name: 'WhatsApp Support',
  channel_type: 'Channel::Api',
  timezone: 'Asia/Karachi',
  working_hours_enabled: false
)
agent = account.users.first

demo_data = [
  { name: 'Ahmed Khan',     phone: '+923001234567', email: 'ahmed.khan@gmail.com',    company: 'Khan Traders',        msg: 'I need help with my order delivery status',    status: 'open'     },
  { name: 'Sara Malik',     phone: '+923211234568', email: 'sara.malik@yahoo.com',     company: 'Malik Enterprises',   msg: 'When will my invoice be ready for this month?', status: 'open'     },
  { name: 'Usman Ali',      phone: '+923451234569', email: 'usman.ali@gmail.com',      company: 'Ali & Sons',          msg: 'Product return request #4521 still pending',   status: 'pending'  },
  { name: 'Fatima Zahra',   phone: '+923011234570', email: 'fatima.z@hotmail.com',     company: 'Zahra Boutique',      msg: 'I want to upgrade my subscription plan',       status: 'open'     },
  { name: 'Bilal Hussain',  phone: '+923331234571', email: 'bilal.h@gmail.com',        company: 'Hussain Corp',        msg: 'Payment failed for order #8821, please help',  status: 'resolved' },
  { name: 'Nadia Farooq',   phone: '+923151234572', email: 'nadia.f@gmail.com',        company: 'Farooq Solutions',    msg: 'Need urgent technical support for our system', status: 'open'     },
  { name: 'Tariq Mehmood',  phone: '+923061234573', email: 'tariq.m@outlook.com',      company: 'Mehmood Industries',  msg: 'Can I change my delivery address for order?',  status: 'resolved' },
  { name: 'Zainab Raza',    phone: '+923421234574', email: 'zainab.r@gmail.com',       company: 'Raza Fabrics',        msg: 'Bulk order inquiry for upcoming Eid season',   status: 'open'     },
  { name: 'Kamran Sheikh',  phone: '+923201234575', email: 'kamran.s@gmail.com',       company: 'Sheikh Motors',       msg: 'Account verification documents submitted',     status: 'pending'  },
  { name: 'Hina Qureshi',   phone: '+923091234576', email: 'hina.q@yahoo.com',         company: 'Qureshi Foods',       msg: 'Complaint about damaged goods received',       status: 'open'     },
  { name: 'Asim Javed',     phone: '+923251234577', email: 'asim.j@gmail.com',         company: 'Javed Electronics',   msg: 'Request for annual service contract renewal',  status: 'resolved' },
  { name: 'Sobia Nawaz',    phone: '+923101234578', email: 'sobia.n@gmail.com',        company: 'Nawaz Textiles',      msg: 'Pricing inquiry for wholesale account setup',  status: 'open'     },
]

demo_data.each_with_index do |d, i|
  contact = Contact.find_or_initialize_by(account: account, email: d[:email])
  contact.assign_attributes(name: d[:name], phone_number: d[:phone], company_name: d[:company])
  contact.save!

  contact_inbox = ContactInbox.find_or_create_by!(contact: contact, inbox: inbox)

  convo = Conversation.create!(
    account: account, inbox: inbox, contact: contact,
    contact_inbox: contact_inbox, status: d[:status], assignee: agent,
    created_at: (demo_data.length - i).hours.ago,
    updated_at: (demo_data.length - i).hours.ago
  )

  Message.create!(
    account: account, inbox: inbox, conversation: convo,
    contact: contact, message_type: :incoming, content: d[:msg],
    created_at: (demo_data.length - i).hours.ago
  )

  reply = d[:status] == 'resolved' ?
    'Thank you for contacting us. Your issue has been fully resolved. Have a wonderful day!' :
    'Hello! Thank you for reaching out to BlinkOne support. I am looking into this for you right now.'

  Message.create!(
    account: account, inbox: inbox, conversation: convo,
    author: agent, message_type: :outgoing, content: reply,
    created_at: ((demo_data.length - i) - 1).hours.ago
  )

  puts \"✅ #{d[:name]} (#{d[:status]})\"
end
puts \"Done! #{demo_data.length} conversations seeded.\"
"
```

---

### STEP 10 — Seed Demo Tickets (8 tickets)

> **Skip if you already ran Part E of PROMPT_24** — tickets already exist.

```bash
cd /opt/blinkone
TICKET_TOKEN=$(grep "^TICKET_TOKEN=" /opt/blinkone/.env | cut -d= -f2)

# If TICKET_TOKEN is empty, use a fallback (check gateway JWT_SECRET instead)
if [ -z "$TICKET_TOKEN" ]; then
  echo "⚠️  TICKET_TOKEN not found in .env — check gateway logs for the correct token"
  docker logs blinkone-gateway-1 --tail 20
fi

tickets=(
  '{"title":"Cannot login to portal","status":"open","priority":"high","customerName":"Ahmed Khan","customerEmail":"ahmed.khan@gmail.com","department":"support","chatwootAccountId":1}'
  '{"title":"Invoice not received for April","status":"open","priority":"medium","customerName":"Sara Malik","customerEmail":"sara.malik@yahoo.com","department":"billing","chatwootAccountId":1}'
  '{"title":"Product damaged on delivery","status":"in-progress","priority":"urgent","customerName":"Hina Qureshi","customerEmail":"hina.q@yahoo.com","department":"support","chatwootAccountId":1}'
  '{"title":"Request for bulk pricing","status":"open","priority":"low","customerName":"Zainab Raza","customerEmail":"zainab.r@gmail.com","department":"sales","chatwootAccountId":1}'
  '{"title":"Payment gateway timeout error","status":"resolved","priority":"high","customerName":"Bilal Hussain","customerEmail":"bilal.h@gmail.com","department":"support","chatwootAccountId":1}'
  '{"title":"Change account email address","status":"open","priority":"medium","customerName":"Kamran Sheikh","customerEmail":"kamran.s@gmail.com","department":"support","chatwootAccountId":1}'
  '{"title":"Upgrade to Enterprise plan","status":"in-progress","priority":"medium","customerName":"Fatima Zahra","customerEmail":"fatima.z@hotmail.com","department":"sales","chatwootAccountId":1}'
  '{"title":"API integration not working","status":"open","priority":"urgent","customerName":"Nadia Farooq","customerEmail":"nadia.f@gmail.com","department":"support","chatwootAccountId":1}'
)

for ticket in "${tickets[@]}"; do
  curl -s -X POST http://localhost:8791/v1/tickets \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TICKET_TOKEN" \
    -d "$ticket" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Ticket:', d.get('title', d))"
done

echo "Done seeding tickets!"
```

---

### STEP 11 — Seed Demo SLA Policies (3 tiers)

> **Skip if you already ran Part F of PROMPT_24** — SLA policies already exist.

```bash
cd /opt/blinkone
SLA_TOKEN=$(grep "^SLA_TOKEN=" /opt/blinkone/.env | cut -d= -f2)

curl -s -X POST http://localhost:8796/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SLA_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -d '{"name":"Gold - 1hr response","firstResponseMinutes":60,"resolveMinutes":240}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d.get('name','created'))"

curl -s -X POST http://localhost:8796/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SLA_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -d '{"name":"Silver - 4hr response","firstResponseMinutes":240,"resolveMinutes":480}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d.get('name','created'))"

curl -s -X POST http://localhost:8796/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SLA_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -d '{"name":"Bronze - 24hr response","firstResponseMinutes":1440,"resolveMinutes":4320}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d.get('name','created'))"

echo "Done seeding SLA policies!"
```

---

### STEP 12 — Rebuild and restart Next.js frontend

After pulling the latest code, rebuild the frontend:

```bash
cd /opt/blinkone/frontend

# Install any new dependencies
npm install --production=false

# Rebuild with production env
npm run build

# Restart PM2 with the new build
pm2 restart blinkone-frontend
pm2 save

echo "✅ Frontend rebuilt and restarted"
pm2 status
```

---

### STEP 13 — Full System Health Check

Run this after completing all steps above:

```bash
echo "========================================="
echo "  BlinkOne Full Health Check"
echo "========================================="

echo ""
echo "--- Container Status ---"
cd /opt/blinkone && docker compose ps

echo ""
echo "--- Nginx Status ---"
systemctl is-active nginx && echo "✅ Nginx running" || echo "❌ Nginx DOWN"

echo ""
echo "--- PM2 Frontend ---"
pm2 status

echo ""
echo "--- Chatwoot Auth Test ---"
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/sign_in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}')

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['access_token'])" 2>/dev/null)

if [ -n "$ACCESS_TOKEN" ]; then
  echo "✅ Chatwoot auth OK, token: ${ACCESS_TOKEN:0:20}..."
else
  echo "❌ Chatwoot auth FAILED"
  echo "$AUTH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)" 2>/dev/null || echo "$AUTH_RESPONSE"
fi

echo ""
echo "--- Gateway Health ---"
curl -s http://localhost:8787/health 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Gateway:', d)" 2>/dev/null || \
  curl -s -o /dev/null -w "Gateway HTTP %{http_code}" http://localhost:8787/health && echo ""

echo ""
echo "--- Tickets Health ---"
curl -s http://localhost:8791/healthz | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Tickets:', d)" 2>/dev/null || echo "❌ Tickets not responding"

echo ""
echo "--- SLA Health ---"
curl -s http://localhost:8796/healthz | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d)" 2>/dev/null || echo "❌ SLA not responding"

echo ""
echo "--- Escalation Health ---"
curl -s http://localhost:8797/healthz | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Escalation:', d)" 2>/dev/null || echo "❌ Escalation not responding"

echo ""
echo "--- Routing Health ---"
curl -s http://localhost:8798/healthz | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Routing:', d)" 2>/dev/null || echo "❌ Routing not responding"

echo ""
echo "========================================="
echo "  Visit: https://app.blinksone.com/login"
echo "  Email:    admin@blinksone.com"
echo "  Password: Demo@2026!"
echo "========================================="
```

---

### STEP 14 — Create a second demo agent (optional but impressive)

Having a second agent makes the demo more realistic when showing conversation assignment.

```bash
cd /opt/blinkone

docker compose exec chatwoot bundle exec rails runner "
account = Account.first

# Check if agent already exists
if account.users.find_by(email: 'agent@blinksone.com')
  puts '⚠️  Agent already exists'
else
  agent = User.new(
    name: 'Demo Agent',
    email: 'agent@blinksone.com',
    password: 'Demo@2026!',
    password_confirmation: 'Demo@2026!'
  )
  agent.skip_confirmation!
  agent.save!

  AccountUser.create!(
    account: account,
    user: agent,
    role: :agent
  )

  puts '✅ Demo agent created: agent@blinksone.com / Demo@2026!'
end
"
```

---

## TROUBLESHOOTING

### ❌ Conversations page empty after login
1. Check `underscores_in_headers on` is in Nginx config (Step 5)
2. Check `NEXT_PUBLIC_USE_DEMO_DATA=false` in `.env.production`
3. Verify Chatwoot conversations exist: `curl -s http://localhost:3000/api/v1/accounts/1/conversations -H "api_access_token: $ACCESS_TOKEN"`

### ❌ "Gateway token exchange failed" on login
1. Check gateway is running: `docker compose ps gateway`
2. Check gateway port is exposed: `ss -tlnp | grep 8787`
3. Check gateway logs: `docker logs blinkone-gateway-1 --tail 30`

### ❌ Tickets page empty
1. Check tickets service: `curl -s http://localhost:8791/healthz`
2. Check postgres_app is healthy: `docker compose ps postgres_app`
3. Check tickets logs: `docker logs blinkone-tickets-1 --tail 30`

### ❌ PM2 frontend not starting
```bash
pm2 delete blinkone-frontend
cd /opt/blinkone/frontend
pm2 start ecosystem.config.js --env production 2>/dev/null || \
  pm2 start npm --name blinkone-frontend -- start
pm2 save
```

### ❌ SSL certificate expired
```bash
certbot renew --nginx --non-interactive
systemctl reload nginx
```

---

## SUMMARY TABLE

| Step | Location | Action | Status Check |
|------|----------|--------|-------------|
| 1 | Local | Fix `.gitignore` — remove `.next/` from git | `git status` shows no `.next/` |
| 2 | Local | Wire Twilio SIP env vars (optional) | `isSipReady()` returns true |
| 3 | Local | Confirm `USE_DEMO_DATA=false` | `.env.production` line check |
| 4 | Local | Commit + push to GitHub | GitHub shows no `.next/` dir |
| 5 | Server | Nginx `underscores_in_headers on` | `nginx -t` passes |
| 6 | Server | `git pull` latest code | `Already up to date` or changes |
| 7 | Server | Start all backend services | All containers `Up` |
| 8 | Server | Expose service ports | `ss -tlnp` shows 8791, 8796-8798 |
| 9 | Server | Seed 12 Chatwoot conversations | Dashboard shows conversations |
| 10 | Server | Seed 8 demo tickets | Tickets page shows data |
| 11 | Server | Seed 3 SLA policies | SLA page shows Gold/Silver/Bronze |
| 12 | Server | Rebuild + restart frontend | PM2 shows `online` |
| 13 | Server | Full health check | All ✅ |
| 14 | Server | Create second demo agent (optional) | Login with agent@blinksone.com |

---

## DEMO LOGIN CREDENTIALS

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@blinksone.com | Demo@2026! |
| Agent | agent@blinksone.com | Demo@2026! |

**Demo URL:** https://app.blinksone.com/login
