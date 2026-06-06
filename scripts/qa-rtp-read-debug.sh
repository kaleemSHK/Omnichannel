#!/usr/bin/env bash
set -uo pipefail
echo "=== last offer/answer commands ==="
docker logs --tail 1200 blinkone-rtpengine 2>&1 | grep -nE "command '(offer|answer|delete)'|Creating new call|monologue|Received" | tail -30

echo
echo "=== SDP bodies (in + out) ==="
docker logs --tail 1200 blinkone-rtpengine 2>&1 | grep -nE '^v=0|^o=|^m=|a=setup|a=fingerprint|a=rtpmap|a=candidate|a=crypto|a=ice|RTP/SAVPF|RTP/AVP|a=rtcp|a=mid' | tail -120

echo
echo "=== DTLS / ICE / crypto activity ==="
docker logs --tail 1200 blinkone-rtpengine 2>&1 | grep -niE 'dtls|ice|crypto|fingerprint|handshake|consent|srtp|peer' | tail -40

echo
echo "=== errors / warnings ==="
docker logs --tail 1200 blinkone-rtpengine 2>&1 | grep -niE 'ERR|WARN|fail|no available|unknown codec' | tail -30
echo "READ-DEBUG-DONE"
