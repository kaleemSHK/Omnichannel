#!/usr/bin/env bash
set -uo pipefail
echo "=== Kamailio active dialogs (dlg.list) ==="
docker exec blinkone-kamailio kamcmd dlg.list 2>/dev/null | grep -E 'state|callid|from_uri|to_uri|start_ts' | head -60 || echo "(dlg module unavailable)"
echo
echo "=== Kamailio dialog count ==="
docker exec blinkone-kamailio kamcmd dlg.stats_active 2>/dev/null || echo "(stats unavailable)"
echo
echo "=== Active rtpengine sessions ==="
docker exec blinkone-rtpengine rtpengine-ctl list sessions 2>/dev/null | head -40 || echo "(ctl unavailable)"
docker exec blinkone-rtpengine rtpengine-ctl list totals 2>/dev/null || true
echo
echo "=== Recent outbound INVITE / 500 / BYE to Twilio (last 200 kamailio log lines) ==="
docker logs --tail 400 blinkone-kamailio 2>&1 | grep -iE 'pstn.twilio|concurrent|500|OUTBOUND|BYE|CANCEL|INVITE ru' | tail -40
echo "TRUNK-DIAG-DONE"
