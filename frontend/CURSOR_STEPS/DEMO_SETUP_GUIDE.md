# BlinkOne — 1 Month Client Demo Setup Guide
### Pakistan · Real clients · All features live

---

## Recommended Stack (Best Cost + Performance for Pakistan)

| Layer | Service | Cost |
|-------|---------|------|
| Server | Hetzner CX32 (Helsinki) | €7.49/mo |
| Domain | Namecheap .com | $1.98 (first year promo) |
| SSL | Let's Encrypt | Free |
| CDN + DDoS | Cloudflare | Free |
| WhatsApp | Meta Cloud API direct | Free + Meta usage fees |
| SIP Trunk | Zadarma | ~$5–10 (pay per use) |
| Email | Resend | Free (3,000/mo) |
| Storage | Backblaze B2 | ~$1–2 |
| **TOTAL** | | **~$20–25 for the full month** |

---

## PHASE 1 — Accounts & Registrations (Day 1 — Do these first, some take 24-48hrs)

### 1.1 — Buy a Domain (10 minutes)

1. Go to **namecheap.com**
2. Search for `blinksone.com` or your brand name
3. Use coupon `NEWCOM598` → first .com year for **$1.98**
4. At checkout → **do NOT buy** their WhoisGuard, hosting, or SSL add-ons (we use free alternatives)
5. Complete purchase

### 1.2 — Set Up Cloudflare (15 minutes)

1. Go to **cloudflare.com** → Create free account
2. Click "Add a Site" → enter your domain
3. Select **Free plan**
4. Cloudflare will show you 2 nameservers like:
   ```
   asha.ns.cloudflare.com
   brad.ns.cloudflare.com
   ```
5. Go back to Namecheap → Domain List → Manage → **Nameservers** → Custom DNS → paste Cloudflare nameservers
6. Wait 10–30 minutes for propagation
7. **Keep the Cloudflare dashboard open** — you will add DNS records throughout this guide

### 1.3 — Create Hetzner Account + Server (20 minutes)

1. Go to **hetzner.com/cloud** → Sign up
2. Add a credit/debit card (Mastercard/Visa works from Pakistan)
3. Create new project → name it `blinkone-demo`
4. Click **Add Server**:
   - **Location**: Helsinki (best ping from Pakistan ~120ms, better than US)
   - **Image**: Ubuntu 22.04 LTS
   - **Type**: **CX32** (4 vCPU, 8GB RAM) — €7.49/mo
   - **Networking**: Enable IPv4 + IPv6
   - **SSH Keys**: Click "Add SSH Key" → paste your public key
     ```bash
     # On your local machine generate SSH key:
     ssh-keygen -t ed25519 -C "blinkone-demo"
     cat ~/.ssh/id_ed25519.pub
     # Copy the output and paste into Hetzner
     ```
   - **Name**: `blinkone-main`
5. Click **Create & Buy** — server is ready in ~30 seconds
6. Note the server's **public IP address** → yours is `204.168.137.104`

### 1.4 — Point Domain to Server in Cloudflare (5 minutes)

In Cloudflare DNS → Add these records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `204.168.137.104` | ✅ Proxied |
| A | `www` | `204.168.137.104` | ✅ Proxied |
| A | `app` | `204.168.137.104` | ✅ Proxied |

> ⚠️ For the SIP/Asterisk subdomain, proxy must be OFF:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `sip` | `204.168.137.104` | ☁️ DNS only (grey cloud) |

### 1.5 — Create Meta Business Account (WhatsApp) — Do this Day 1, takes 24-72 hrs to verify

1. Go to **business.facebook.com** → Create account
   - Business name: your company name
   - You will need: business address, phone number, website
2. Go to **developers.facebook.com** → My Apps → Create App
   - Type: **Business**
   - App name: `BlinkOne Demo`
3. Add **WhatsApp product** to your app
4. In WhatsApp → Getting Started:
   - You get a **test phone number** (free, 5 numbers only for testing)
   - Note your **Phone Number ID** and **WhatsApp Business Account ID (WABA ID)**
5. Generate a **permanent access token**:
   - Go to Meta Business Settings → **System Users** → Add System User
   - Role: **Admin**
   - Click "Generate Token" → select your app → check `whatsapp_business_messaging` permission
   - **Save this token** — you only see it once
6. Set up webhook (do this after server is ready in Phase 2):
   - Webhook URL: `https://app.blinksone.com/webhooks/whatsapp`
   - Verify Token: make up any string e.g. `blinkone_wh_2026`

### 1.6 — Create Zadarma Account (SIP Calling)

1. Go to **zadarma.com** → Sign up (free)
2. Top up $10 via credit card (pay per use after that)
3. Go to **My PBX** → SIP Users → Create SIP user:
   - Username: `agent1`
   - Password: save it
4. Go to **Numbers** → Buy a number (Pakistan +92 or any country your client wants) — ~$2–5/mo
5. Note your:
   - SIP server: `sip.zadarma.com`
   - SIP username: your account number (shown in dashboard)
   - SIP password: from settings
6. Go to **Settings** → Enable **WebRTC** (required for browser calling)

### 1.7 — Create Resend Account (Email)

1. Go to **resend.com** → Sign up free
2. Add your domain for sending
3. Resend will give you DNS records to add to Cloudflare (copy them in)
4. Note your **API key**

---

## PHASE 2 — Server Setup (Day 2 — ~2 hours total)

### 2.1 — Connect to Server

```bash
ssh root@204.168.137.104
```

### 2.2 — Initial Server Configuration

```bash
# Update system
apt update && apt upgrade -y

# Install essentials
apt install -y curl git wget ufw fail2ban htop unzip

# Set timezone to Pakistan
timedatectl set-timezone Asia/Karachi

# Create a non-root user
adduser blinkone
usermod -aG sudo blinkone

# Copy SSH key to new user
cp -r ~/.ssh /home/blinkone/
chown -R blinkone:blinkone /home/blinkone/.ssh

# Configure firewall
ufw allow OpenSSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw allow 5060/udp    # SIP
ufw allow 5061/tcp    # SIP TLS
ufw allow 10000:20000/udp  # RTP media (calls audio)
ufw --force enable

echo "✅ Server base config done"
```

### 2.3 — Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker blinkone
usermod -aG docker root

# Install Docker Compose v2
apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version

echo "✅ Docker installed"
```

### 2.4 — Install Nginx (Reverse Proxy)

```bash
apt install -y nginx

# Remove default site
rm /etc/nginx/sites-enabled/default

echo "✅ Nginx installed"
```

### 2.5 — Install SSL via Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificates (replace with your domain)
certbot --nginx -d blinksone.com -d app.blinksone.com -d www.blinksone.com \
  --non-interactive --agree-tos -m your@email.com

# Auto-renew (already set up by certbot, verify)
systemctl status certbot.timer

echo "✅ SSL certificates installed"
```

> ⚠️ **Note**: Cloudflare proxy must be set to **DNS only (grey cloud)** for your domain temporarily while Certbot verifies. After getting certs, switch back to **Proxied (orange cloud)**.

### 2.6 — Configure Nginx

```bash
cat > /etc/nginx/sites-available/blinkone << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name blinksone.com app.blinksone.com www.blinksone.com;
    return 301 https://$host$request_uri;
}

# Main app (Next.js frontend)
server {
    listen 443 ssl;
    server_name app.blinksone.com blinksone.com www.blinksone.com;

    ssl_certificate /etc/letsencrypt/live/blinksone.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blinksone.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Next.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Chatwoot API proxy (/_cw/* → Chatwoot on port 3000)
    location /_cw/ {
        rewrite ^/_cw/(.*)$ /$1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # BlinkOne gateway proxy (/_gw/* → gateway on port 4000)
    location /_gw/ {
        rewrite ^/_gw/(.*)$ /$1 break;
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for ActionCable (Chatwoot real-time)
    location /cable {
        proxy_pass http://localhost:3000/cable;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
EOF

# Enable the site
ln -s /etc/nginx/sites-available/blinkone /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "✅ Nginx configured"
```

### 2.7 — Deploy Chatwoot via Docker

```bash
# Create directory
mkdir -p /opt/chatwoot && cd /opt/chatwoot

# Download official Chatwoot docker-compose
wget https://raw.githubusercontent.com/chatwoot/chatwoot/develop/docker-compose.production.yaml \
  -O docker-compose.yml

# Create environment file
cat > .env << 'EOF'
# ─── Core ────────────────────────────────────────────────
SECRET_KEY_BASE=REPLACE_WITH_64_CHAR_RANDOM_STRING
FRONTEND_URL=https://app.blinksone.com

# ─── Database ────────────────────────────────────────────
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# ─── Email (Resend SMTP) ─────────────────────────────────
MAILER_SENDER_EMAIL=noreply@blinksone.com
SMTP_ADDRESS=smtp.resend.com
SMTP_PORT=465
SMTP_USERNAME=resend
SMTP_PASSWORD=re_YOUR_RESEND_API_KEY
SMTP_AUTHENTICATION=plain
SMTP_ENABLE_STARTTLS_AUTO=true

# ─── Storage (local for demo — switch to B2 for production) ──
ACTIVE_STORAGE_SERVICE=local

# ─── WhatsApp (Meta Cloud API) ──────────────────────────
WHATSAPP_CLOUD_API_TOKEN=YOUR_META_PERMANENT_TOKEN

# ─── Features ────────────────────────────────────────────
ENABLE_ACCOUNT_SIGNUP=false
EOF

# Generate secret key (run this and paste output into .env above)
openssl rand -hex 32

# Start Chatwoot
docker compose up -d

# Wait for DB to be ready then run migrations
sleep 30
docker compose exec rails bundle exec rails db:chatwoot_prepare

echo "✅ Chatwoot running on port 3000"
```

### 2.8 — Deploy BlinkOne Frontend (Next.js)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Clone your repo
cd /opt
git clone https://github.com/YOUR_ORG/blinkone.git
cd blinkone/frontend

# Create production env file
cat > .env.production << 'EOF'
# Chatwoot
CHATWOOT_UPSTREAM=http://localhost:3000
NEXT_PUBLIC_CHATWOOT_URL=https://app.blinksone.com/_cw

# Gateway
GATEWAY_UPSTREAM=http://localhost:4000

# SIP (Zadarma WebRTC)
NEXT_PUBLIC_SIP_WSS=wss://wss.zadarma.com
NEXT_PUBLIC_SIP_DOMAIN=sip.zadarma.com
NEXT_PUBLIC_SIP_USER=YOUR_ZADARMA_SIP_USERNAME
NEXT_PUBLIC_SIP_PASS=YOUR_ZADARMA_SIP_PASSWORD

# App
NEXT_PUBLIC_APP_URL=https://app.blinksone.com
NEXT_PUBLIC_USE_DEMO_DATA=false

# Demo mode OFF for real client demo
EOF

# Install dependencies and build
npm install
npm run build

# Start with PM2
pm2 start npm --name "blinkone" -- start
pm2 save
pm2 startup

echo "✅ Next.js frontend running on port 3001"
```

### 2.9 — Set Up Asterisk + Kamailio (SIP Server)

For the 1-month demo the **simplest approach** is to use **Zadarma's cloud PBX** (no self-hosted Asterisk needed). This saves 2-3 hours of setup and avoids firewall/NAT issues from Pakistan.

```bash
# No Asterisk install needed for demo —
# Zadarma cloud handles SIP registration, call routing, and PSTN

# Your agents connect their browsers directly to Zadarma WSS:
# NEXT_PUBLIC_SIP_WSS=wss://wss.zadarma.com

# For each agent, create a SIP user in Zadarma dashboard:
# zadarma.com → My PBX → SIP Users → Add
# Each user gets: username, password, SIP domain = sip.zadarma.com
```

> ✅ **Zadarma cloud PBX = zero server setup, zero NAT issues, WebRTC-ready**
> 
> After the demo, for on-premises you install Asterisk + Kamailio on your own hardware.

---

## PHASE 3 — WhatsApp Configuration (Day 2-3)

### 3.1 — Create WhatsApp Inbox in Chatwoot

1. Open `https://app.blinksone.com` → Login as admin
2. Go to **Settings → Inboxes → Add Inbox**
3. Choose **WhatsApp**
4. Select provider: **WhatsApp Cloud**
5. Fill in:
   - **Phone Number ID**: from Meta developer dashboard
   - **Business Account ID**: your WABA ID
   - **API Access Token**: your permanent system user token
   - **Webhook Verify Token**: `blinkone_wh_2026` (match what you set in Meta)
6. Click Create

### 3.2 — Set Up Meta Webhook

1. Go to **developers.facebook.com** → Your App → WhatsApp → Configuration
2. **Webhook URL**: `https://app.blinksone.com/webhooks/whatsapp`
3. **Verify Token**: `blinkone_wh_2026`
4. Click **Verify and Save**
5. Subscribe to webhook fields: `messages`

### 3.3 — Test WhatsApp

```
From your personal WhatsApp:
Send a message to your business WhatsApp number

→ Should appear in Chatwoot inbox within 3-5 seconds
→ Agent can reply from the BlinkOne conversations screen
```

### 3.4 — Add a Real Phone Number (for client demo)

The Meta test number only allows 5 recipients. For a real demo:

1. In Meta Business → WhatsApp → Phone Numbers → **Add phone number**
2. Use a Pakistani SIM (+92) or buy a virtual number
3. Verify via OTP
4. Submit for **Display Name** review (takes 24-48 hrs)
5. Once approved, clients can message this number from any WhatsApp

---

## PHASE 4 — Calling Configuration (Day 3)

### 4.1 — Configure Zadarma for Demo

In **zadarma.com** dashboard:

1. **My PBX → SIP Users** → Create one user per agent:
   ```
   Agent 1: username=agent1, password=xxxx
   Agent 2: username=agent2, password=xxxx
   ```

2. **Numbers → Routing**:
   - Incoming calls to your DID → route to SIP user group
   - Enable call recording (for demo — clients love this)

3. **My PBX → WebRTC**:
   - Enable WebRTC
   - Note the WSS endpoint: `wss://wss.zadarma.com`

4. Update BlinkOne `.env.production` per agent or use a shared SIP account for demo:
   ```
   NEXT_PUBLIC_SIP_WSS=wss://wss.zadarma.com
   NEXT_PUBLIC_SIP_DOMAIN=sip.zadarma.com
   NEXT_PUBLIC_SIP_USER=agent1
   NEXT_PUBLIC_SIP_PASS=your_password
   ```

### 4.2 — Test Calling

```
1. Open BlinkOne → /calling
2. Check SIP status badge at top of call list → should show "Registered" (green)
3. Use dialpad to call your own mobile number
4. Answer on mobile → verify two-way audio works
5. Test: mute, hold, hangup
```

---

## PHASE 5 — Final Configuration & Demo Data (Day 4)

### 5.1 — Create Demo Accounts in Chatwoot

```bash
# SSH into server
ssh root@204.168.137.104

# Open Rails console
docker compose -f /opt/chatwoot/docker-compose.yml exec rails bundle exec rails console

# Create admin account
Account.first.users.create!(
  name: "Demo Admin",
  email: "admin@blinksone.com",
  password: "Demo@2026!",
  role: :administrator
)

# Create agent accounts
Account.first.users.create!(
  name: "Agent One",
  email: "agent1@blinksone.com",
  password: "Agent@2026!",
  role: :agent
)

exit
```

### 5.2 — Enable Demo Data for Presentation

If you want to show the UI with pre-filled data during the demo:

```bash
# In /opt/blinkone/frontend/.env.production
# Change this line temporarily:
NEXT_PUBLIC_USE_DEMO_DATA=true

# Rebuild
cd /opt/blinkone/frontend
npm run build
pm2 restart blinkone
```

Switch back to `false` when showing real WhatsApp messages.

### 5.3 — Set Up Monitoring (Free)

1. Go to **uptimerobot.com** → Free account
2. Add monitor: `https://app.blinksone.com` → HTTP monitor → every 5 mins
3. Add your phone/email for alerts
4. This emails/SMS you if the server goes down during demo

---

## PHASE 6 — Pre-Demo Checklist

Run through this the day before showing clients:

```
INFRASTRUCTURE
[ ] Server running: ssh root@204.168.137.104 works
[ ] Website loads: https://app.blinksone.com opens
[ ] SSL green padlock shows in browser
[ ] Login works with admin@blinksone.com

WHATSAPP
[ ] Send message from personal WhatsApp to business number
[ ] Message appears in BlinkOne Conversations within 5 seconds
[ ] Reply from BlinkOne → client receives on WhatsApp
[ ] Attachments (image/PDF) send and receive correctly

CALLING
[ ] SIP badge shows "Registered" in /calling
[ ] Outbound call to mobile works, audio both ways
[ ] Inbound call from mobile to DID number rings in browser
[ ] Mute, hold, transfer buttons work

REPORTS
[ ] /reports loads with real data (not all zeros)
[ ] Date range switching works (Today / 7 days / 30 days)

CONTACTS
[ ] Can create a new contact
[ ] Can call contact directly from contact page
[ ] Contact links to conversations correctly

SETTINGS
[ ] Can add a new agent from Settings → Agents
[ ] Can create inbox from Settings → Inboxes
```

---

## PHASE 7 — What to Show the Client (Demo Script)

### Opening (5 minutes)
- Show the dashboard overview
- Explain the 4 modules: Conversations, Calling, Contacts, Reports

### WhatsApp Demo (10 minutes)
- Have client send a WhatsApp message to your number
- Show it arriving in real-time in Conversations
- Reply → client sees it instantly
- Show canned responses, private notes, labels

### Calling Demo (10 minutes)
- Call client's number from the dialpad
- Show inbound call ringing in browser
- Show mute, hold, transfer
- Show call timeline in conversation

### Reports Demo (5 minutes)
- Show KPI cards (conversations, resolution time)
- Show agent performance table
- Export CSV to show it's real data

### Settings Demo (5 minutes)
- Show how to add agents
- Show how WhatsApp inbox is configured
- Show automation rules

---

## Complete Cost for 1 Month Demo

| Item | Provider | Cost |
|------|---------|------|
| Server CX32 | Hetzner | €7.49 (~$8) |
| Domain .com | Namecheap | $1.98 |
| SSL | Let's Encrypt | Free |
| CDN + DDoS | Cloudflare | Free |
| WhatsApp API | Meta (direct) | Free + ~$3 usage |
| SIP calls | Zadarma | ~$10 topup |
| Email | Resend | Free |
| Monitoring | UptimeRobot | Free |
| **TOTAL** | | **~$23 for the full month** |

---

## After the Demo — Moving to On-Premises

When you move to your own hardware (Pakistan office), the checklist is:

```
Hardware needed:
[ ] Server: min 16GB RAM, 8 core CPU, 500GB SSD
[ ] Stable internet: min 50 Mbps symmetric, static IP preferred
[ ] UPS (power backup) — critical for Pakistan power cuts
[ ] Router with DMZ or port forwarding for SIP ports

Software to install on-premises:
[ ] Ubuntu 22.04 LTS
[ ] Docker + Docker Compose
[ ] Chatwoot (same docker-compose)
[ ] Asterisk 20 (replace Zadarma)
[ ] Kamailio 5.8 (SIP proxy)
[ ] RTPEngine (media relay)
[ ] Nginx + Let's Encrypt (or self-signed cert)

For static IP if not available:
[ ] Use ngrok or Cloudflare Tunnel for HTTPS
[ ] For SIP without static IP: keep Zadarma as SIP trunk
    (Asterisk at office → Zadarma as upstream trunk)
```

---

## Quick Reference — Important Credentials to Save

Create a secure text file with all these (use a password manager):

```
SERVER
  IP: 204.168.137.104
  SSH: ssh root@204.168.137.104
  
DOMAIN
  Domain: blinksone.com
  Registrar: Namecheap
  DNS: Cloudflare

CHATWOOT
  URL: https://app.blinksone.com
  Admin: admin@blinksone.com / Demo@2026!
  DB Password: [saved]
  Secret Key Base: [saved]

META / WHATSAPP
  App ID: [saved]
  Phone Number ID: [saved]
  WABA ID: [saved]
  System User Token: [NEVER share this]
  Webhook Verify Token: blinkone_wh_2026

ZADARMA
  Account: [saved]
  SIP User: agent1 / [password]
  SIP Server: sip.zadarma.com
  WSS: wss://wss.zadarma.com
  DID Number: +92xxxxxxxxxx

RESEND
  API Key: re_[saved]
  Sender: noreply@blinksone.com
```
