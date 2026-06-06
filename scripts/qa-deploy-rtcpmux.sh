#!/usr/bin/env bash
set -uo pipefail
TS=$(date +%Y%m%d-%H%M%S)

echo "=== deploy kamailio cfg (rtcp-mux fix) ==="
cp -a /etc/kamailio/kamailio.cfg "/etc/kamailio/kamailio.cfg.bak.$TS"
cp /tmp/kam.cfg /etc/kamailio/kamailio.cfg
if /usr/sbin/kamailio -c -f /etc/kamailio/kamailio.cfg >/tmp/kamcheck.log 2>&1; then
  systemctl restart kamailio; sleep 2
  systemctl is-active kamailio && echo "kamailio active" || { echo "FAILED — rollback"; cp "/etc/kamailio/kamailio.cfg.bak.$TS" /etc/kamailio/kamailio.cfg; systemctl restart kamailio; }
else
  echo "CONFIG CHECK FAILED — rollback:"; tail -15 /tmp/kamcheck.log
  cp "/etc/kamailio/kamailio.cfg.bak.$TS" /etc/kamailio/kamailio.cfg; systemctl restart kamailio
fi

echo
echo "=== lower rtpengine log verbosity (6) ==="
CONF=/opt/blinkone/infra/rtpengine/rtpengine-demo.conf
sed -i 's/^log-level.*/log-level = 6/' "$CONF"
docker restart blinkone-rtpengine >/dev/null; sleep 2
echo "rtpengine: $(docker ps --filter name=rtpengine --format '{{.Status}}')"
echo "verify rtcp-mux flag present in cfg:"
grep -c 'rtcp-mux-require' /etc/kamailio/kamailio.cfg
echo "DEPLOY-RTCPMUX-DONE"
