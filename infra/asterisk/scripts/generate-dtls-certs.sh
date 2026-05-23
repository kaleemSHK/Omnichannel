#!/bin/sh
# Generate self-signed DTLS cert for Asterisk WebRTC (dev / on-prem)
set -eu
OUT="${1:-/var/lib/asterisk/certs}"
mkdir -p "$OUT"
CN="${AST_WSS_DOMAIN:-localhost}"

openssl req -new -x509 -days 825 -nodes \
  -subj "/CN=${CN}" \
  -keyout "$OUT/asterisk.key" \
  -out "$OUT/asterisk.crt"

cat "$OUT/asterisk.crt" "$OUT/asterisk.key" > "$OUT/asterisk.pem"
chmod 600 "$OUT/asterisk.key" "$OUT/asterisk.pem"
echo "DTLS certs written to $OUT (CN=$CN)"
