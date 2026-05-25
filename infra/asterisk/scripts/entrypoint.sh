#!/bin/sh
set -eu

CERT_DIR="${ASTERISK_CERT_DIR:-/var/lib/asterisk/certs}"
TENANTS_FILE="${TENANTS_CONFIG:-/etc/asterisk/tenants.yaml}"
GEN_DIR="/etc/asterisk/generated"

mkdir -p "$GEN_DIR" "$CERT_DIR" /var/spool/asterisk/recordings

if [ ! -f "$CERT_DIR/asterisk.pem" ]; then
  /usr/local/bin/generate-dtls-certs.sh "$CERT_DIR"
fi

# Render PJSIP from template + env (tenant trunks added in later prompts)
export AST_EXTERNAL_IP="${AST_EXTERNAL_IP:-127.0.0.1}"
export AST_LOCAL_NET="${AST_LOCAL_NET:-172.16.0.0/12}"
export AST_ARI_USER="${AST_ARI_USER:-blinkone}"
export AST_ARI_PASS="${AST_ARI_PASS:-blinkone-ari-secret}"
export AST_AGENT_SIP_PASS="${AST_AGENT_SIP_PASS:-blinkone-agent-dev}"
export AST_TRUNK_SIP_PASS="${AST_TRUNK_SIP_PASS:-blinkone-trunk-dev}"
export AST_WSS_DOMAIN="${AST_WSS_DOMAIN:-localhost}"
export TWILIO_SIP_HOST="${TWILIO_SIP_HOST:-demo.pstn.twilio.com}"
export TWILIO_DID="${TWILIO_DID:-+10000000000}"

envsubst < /etc/asterisk-templates/pjsip.conf.tpl > "$GEN_DIR/pjsip.conf"
envsubst < /etc/asterisk-templates/ari.conf.tpl > "$GEN_DIR/ari.conf"
envsubst < /etc/asterisk-templates/http.conf.tpl > "$GEN_DIR/http.conf"
envsubst < /etc/asterisk-templates/extensions.conf > "$GEN_DIR/extensions.conf"
cp /etc/asterisk-templates/rtp.conf "$GEN_DIR/rtp.conf"
cp /etc/asterisk-templates/modules.conf "$GEN_DIR/modules.conf"
# Symlink generated configs (image may ship defaults in /etc/asterisk)
for f in pjsip.conf extensions.conf http.conf rtp.conf modules.conf ari.conf; do
  ln -sf "$GEN_DIR/$f" "/etc/asterisk/$f" 2>/dev/null || cp "$GEN_DIR/$f" "/etc/asterisk/$f"
done

if [ -f "$TENANTS_FILE" ]; then
  echo "[entrypoint] tenants config present: $TENANTS_FILE (trunk render in Prompt 5 step 2+)"
fi

chown -R asterisk:asterisk "$GEN_DIR" "$CERT_DIR" /var/spool/asterisk/recordings

if [ "$(id -u)" = "0" ]; then
  exec runuser -u asterisk -- "$@"
fi
exec "$@"
