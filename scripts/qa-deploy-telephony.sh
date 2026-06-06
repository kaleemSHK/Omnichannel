#!/usr/bin/env bash
# BlinkOne telephony remediation deploy.
# Expects these files pre-copied to /tmp:
#   /tmp/kam.cfg              -> /etc/kamailio/kamailio.cfg   (validated + rollback)
#   /tmp/rtp.conf             -> /opt/blinkone/infra/rtpengine/rtpengine-demo.conf
#   /tmp/twilio-voicebot.js   -> /opt/blinkone/services/ivr/lib/twilio-voicebot.js
set -uo pipefail
ROOT=/opt/blinkone
TS=$(date +%Y%m%d-%H%M%S)

echo "############ PART 1: RTPengine (enlarge ports, lower silent-timeout) ############"
if [ -f /tmp/rtp.conf ]; then
  cp -a "$ROOT/infra/rtpengine/rtpengine-demo.conf" "$ROOT/infra/rtpengine/rtpengine-demo.conf.bak.$TS" 2>/dev/null || true
  cp /tmp/rtp.conf "$ROOT/infra/rtpengine/rtpengine-demo.conf"
  echo "rtpengine conf updated:"; grep -E 'port-(min|max)|silent-timeout' "$ROOT/infra/rtpengine/rtpengine-demo.conf"
  docker restart blinkone-rtpengine >/dev/null && echo "rtpengine restarted (leaked ports cleared)"
else
  echo "SKIP: /tmp/rtp.conf missing"
fi

echo
echo "############ PART 2: Kamailio (inbound R-URI match + WS-only fraud guard) ############"
if [ -f /tmp/kam.cfg ]; then
  cp -a /etc/kamailio/kamailio.cfg "/etc/kamailio/kamailio.cfg.bak.$TS"
  cp /tmp/kam.cfg /etc/kamailio/kamailio.cfg
  echo "validating config..."
  if /usr/sbin/kamailio -c -f /etc/kamailio/kamailio.cfg >/tmp/kamcheck.log 2>&1; then
    echo "config OK — restarting kamailio"
    systemctl restart kamailio
    sleep 2
    systemctl is-active kamailio && echo "kamailio active" || { echo "kamailio FAILED to start — rolling back"; cp "/etc/kamailio/kamailio.cfg.bak.$TS" /etc/kamailio/kamailio.cfg; systemctl restart kamailio; }
  else
    echo "CONFIG CHECK FAILED — rolling back. Errors:"; tail -20 /tmp/kamcheck.log
    cp "/etc/kamailio/kamailio.cfg.bak.$TS" /etc/kamailio/kamailio.cfg
  fi
else
  echo "SKIP: /tmp/kam.cfg missing"
fi

echo
echo "############ PART 3: IVR direct-agent dial (Part B) ############"
# 3a. env flags
touch "$ROOT/.env"
if ! grep -q '^DIRECT_AGENT_DIAL=' "$ROOT/.env"; then
  cp -a "$ROOT/.env" "$ROOT/.env.bak.$TS"
  printf '\n# Direct-to-agent inbound (skip voicebot, bridge PSTN to browser via Kamailio)\nDIRECT_AGENT_DIAL=true\nAGENT_SIP_URI=sip:blinkone@204.168.137.104:5060\n' >> "$ROOT/.env"
  echo "added DIRECT_AGENT_DIAL=true + AGENT_SIP_URI to .env"
else
  sed -i 's/^DIRECT_AGENT_DIAL=.*/DIRECT_AGENT_DIAL=true/' "$ROOT/.env"
  echo "DIRECT_AGENT_DIAL set true (already present)"
fi

# 3b. compose env wiring (insert after the ivr block's IVR_PUBLIC_URL line)
python3 - "$ROOT/docker-compose.yml" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
if 'DIRECT_AGENT_DIAL:' in s:
    print("compose already wired")
else:
    lines = s.splitlines(keepends=True)
    out = []
    for ln in lines:
        out.append(ln)
        if 'IVR_PUBLIC_URL:' in ln:
            indent = ln[:len(ln)-len(ln.lstrip())]
            out.append(f"{indent}DIRECT_AGENT_DIAL:     ${{DIRECT_AGENT_DIAL:-false}}\n")
            out.append(f"{indent}AGENT_SIP_URI:         ${{AGENT_SIP_URI:-sip:blinkone@204.168.137.104:5060}}\n")
    open(p,'w').write(''.join(out))
    print("compose wired (added DIRECT_AGENT_DIAL + AGENT_SIP_URI to ivr)")
PY

# 3c. source code
if [ -f /tmp/twilio-voicebot.js ]; then
  cp -a "$ROOT/services/ivr/lib/twilio-voicebot.js" "$ROOT/services/ivr/lib/twilio-voicebot.js.bak.$TS" 2>/dev/null || true
  cp /tmp/twilio-voicebot.js "$ROOT/services/ivr/lib/twilio-voicebot.js"
  echo "twilio-voicebot.js updated"
fi

# 3d. rebuild + recreate ivr
cd "$ROOT"
echo "rebuilding ivr image..."
if docker compose build ivr >/tmp/ivrbuild.log 2>&1; then
  docker compose up -d ivr >/tmp/ivrup.log 2>&1 && echo "ivr recreated"
  docker compose exec -T ivr sh -c 'echo "DIRECT_AGENT_DIAL=$DIRECT_AGENT_DIAL AGENT_SIP_URI=$AGENT_SIP_URI"' 2>/dev/null || true
else
  echo "IVR BUILD FAILED:"; tail -15 /tmp/ivrbuild.log
fi

echo
echo "############ STATUS ############"
echo "-- kamailio registrations --"
kamcmd ul.dump 2>/dev/null | grep -E 'AOR::|Contact::' | head || echo "(0 — agent must have the app open to register)"
echo "DONE-TELEPHONY"
