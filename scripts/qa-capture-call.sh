#!/usr/bin/env bash
# Capture Kamailio + RTPengine logs during a single test call (~90s window).
set -uo pipefail
WIN=90
echo "Capturing for ${WIN}s — place the call NOW..."

: > /tmp/kam-call.log
: > /tmp/rtp-call.log

timeout ${WIN} journalctl -u kamailio -f --no-pager > /tmp/kam-call.log 2>&1 &
KPID=$!
timeout ${WIN} docker logs -f --since 1s blinkone-rtpengine > /tmp/rtp-call.log 2>&1 &
RPID=$!

wait $KPID 2>/dev/null
wait $RPID 2>/dev/null

echo "============ KAMAILIO (INVITE / INBOUND / media) ============"
grep -nE 'INVITE|INBOUND|OUTBOUND|BLOCKED|blinkone|480|403|488|rtpengine|RTP|error|ERROR' /tmp/kam-call.log | tail -50

echo
echo "============ RTPENGINE (offer/answer/ports/codec) ============"
grep -nE 'offer|answer|Creating new call|port|codec|ERR|WARNING|fingerprint|ICE|Failed' /tmp/rtp-call.log | tail -60

echo
echo "============ RTPENGINE full SDP blocks (last call) ============"
tail -80 /tmp/rtp-call.log
echo "CAPTURE-DONE"
