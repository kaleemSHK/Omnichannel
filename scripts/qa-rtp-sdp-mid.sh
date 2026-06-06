#!/usr/bin/env bash
set -uo pipefail
echo "=== group/mid/rtcp-mux/bundle across recent SDPs ==="
docker logs --tail 1500 blinkone-rtpengine 2>&1 | grep -nE 'a=group|a=mid|BUNDLE|rtcp-mux|a=rtcp:|a=setup|a=fingerprint|m=audio|RTP/SAVPF|RTP/AVP|media ID' | tail -80
echo "SDPMID-DONE"
