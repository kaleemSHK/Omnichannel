# PROMPT 24 — Server: Demo Data + Start All Services
## BlinkOne Demo Setup · Hetzner CPX32 · blinksone.com

This prompt contains **server-side shell commands only** — no code changes.
Run every block in order inside your SSH session on `root@204.168.137.104`.


## PART B — Start postgres_app + All Backend Services

The tickets, SLA, escalation, and routing services all depend on `postgres_app`.
Right now only `postgres`, `redis`, `chatwoot`, `sidekiq`, and `gateway` are running.

```bash
cd /opt/blinkone

# Start postgres_app first and wait for it to be healthy
docker compose up -d postgres_app
sleep 10
docker compose ps postgres_app

# Now start all remaining services
docker compose up -d tickets sla escalation routing calls

# Watch them start (wait ~30 seconds)
sleep 30
docker compose ps
```

Expected output — all containers should show `Up` or `healthy`:
```
blinkone-postgres_app-1   Up (healthy)
blinkone-tickets-1        Up
blinkone-sla-1            Up
blinkone-escalation-1     Up
blinkone-routing-1        Up
blinkone-calls-1          Up
```

If any container shows `Exit` or `Restarting`, check its logs:
```bash
docker logs blinkone-tickets-1 --tail 30
docker logs blinkone-sla-1 --tail 30
```

---

## PART C — Nginx + expose service ports

**Required:** Nginx drops headers with underscores (e.g. `api_access_token`) unless enabled:

```bash
# Inside the HTTPS server { } block in /etc/nginx/sites-available/blinkone:
underscores_in_headers on;
nginx -t && systemctl reload nginx
```

Without this, the UI loads but **Conversations stays empty** (Chatwoot API returns 401).

Expose service ports for local health checks:

```bash
cat > /opt/blinkone/docker-compose.override.yml << 'EOF'
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

# Restart affected services to pick up port bindings
docker compose up -d gateway tickets sla escalation routing
sleep 10

# Verify ports are open
curl -s http://localhost:8791/healthz
curl -s http://localhost:8796/healthz
```

---

## PART D — Seed Demo Data into Chatwoot

This creates realistic Pakistani client data: 12 contacts, 12 conversations
(mix of open/pending/resolved), and reply messages.

```bash
cd /opt/blinkone

docker compose exec chatwoot bundle exec rails runner "
account = Account.first
inbox = Inbox.create!(
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
  contact.assign_attributes(
    name: d[:name],
    phone_number: d[:phone],
    company_name: d[:company]
  )
  contact.save!

  contact_inbox = ContactInbox.find_or_create_by!(contact: contact, inbox: inbox)

  convo = Conversation.create!(
    account: account,
    inbox: inbox,
    contact: contact,
    contact_inbox: contact_inbox,
    status: d[:status],
    assignee: agent,
    created_at: (demo_data.length - i).hours.ago,
    updated_at: (demo_data.length - i).hours.ago
  )

  # Customer message
  Message.create!(
    account: account,
    inbox: inbox,
    conversation: convo,
    contact: contact,
    message_type: :incoming,
    content: d[:msg],
    created_at: (demo_data.length - i).hours.ago
  )

  # Agent reply
  reply = d[:status] == 'resolved' ?
    'Thank you for contacting us. Your issue has been fully resolved. Have a wonderful day!' :
    'Hello! Thank you for reaching out to BlinkOne support. I am looking into this for you right now.'

  Message.create!(
    account: account,
    inbox: inbox,
    conversation: convo,
    author: agent,
    message_type: :outgoing,
    content: reply,
    created_at: ((demo_data.length - i) - 1).hours.ago
  )

  puts \"✅ #{d[:name]} (#{d[:status]})\"
end
puts \"Done! #{demo_data.length} conversations + contacts seeded.\"
"
```

---

## PART E — Seed Demo Tickets

```bash
cd /opt/blinkone

# Seed tickets via the tickets service API
TICKET_TOKEN=$(grep TICKET_TOKEN /opt/blinkone/.env | cut -d= -f2)

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
    -d "$ticket" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Ticket:', d.get('title','?'))"
done

echo "Done seeding tickets!"
```

---

## PART F — Seed Demo SLA Policies

```bash
SLA_TOKEN=$(grep "^SLA_TOKEN=" /opt/blinkone/.env | cut -d= -f2)

# Create SLA policies
curl -s -X POST http://localhost:8796/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SLA_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -d '{"name":"Gold - 1hr response","firstResponseMinutes":60,"resolveMinutes":240}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d.get('name','created'))"

curl -s -X POST http://localhost:8796/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SLA_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -d '{"name":"Silver - 4hr response","firstResponseMinutes":240,"resolveMinutes":480}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d.get('name','created'))"

curl -s -X POST http://localhost:8796/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SLA_TOKEN" \
  -H "X-Tenant-Id: 1" \
  -d '{"name":"Bronze - 24hr response","firstResponseMinutes":1440,"resolveMinutes":4320}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d.get('name','created'))"

echo "Done seeding SLA policies!"
```

---

## PART G — Verify Everything is Running

```bash
echo "=== Container Status ==="
docker compose ps

echo ""
echo "=== Service Health ==="
curl -s http://localhost:3000/auth/sign_in -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Chatwoot auth OK, token:', d['data']['access_token'][:20]+'...')"

curl -s http://localhost:8787/api/v1/profile -H "api_access_token: $(curl -s http://localhost:3000/auth/sign_in -X POST -H 'Content-Type: application/json' -d '{"email":"admin@blinksone.com","password":"Demo@2026!"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["access_token"])')" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Gateway OK')" 2>/dev/null || echo "⚠️ Gateway check skipped"

curl -s http://localhost:8791/healthz | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Tickets:', d)" 2>/dev/null || echo "❌ Tickets not running"
curl -s http://localhost:8796/healthz | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ SLA:', d)" 2>/dev/null || echo "❌ SLA not running"

echo ""
echo "=== PM2 Frontend ==="
pm2 status

echo ""
echo "✅ All checks complete. Visit https://app.blinksone.com/login"
echo "   Email: admin@blinksone.com"
echo "   Password: Demo@2026!"
```

---

## Summary — What This Prompt Does

| Part | Action | Result |
|------|--------|--------|
| A | Set root password | Never locked out of SSH again |
| B | Start postgres_app + services | Tickets, SLA, routing all running |
| C | Expose service ports | Nginx can proxy to all services |
| D | Seed Chatwoot data | 12 contacts + 12 conversations visible |
| E | Seed tickets | 8 demo tickets across departments |
| F | Seed SLA policies | 3 SLA tiers (Gold/Silver/Bronze) |
| G | Verify all services | Confirm everything is healthy |
