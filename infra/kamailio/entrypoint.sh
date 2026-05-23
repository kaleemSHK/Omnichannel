#!/bin/bash
set -euo pipefail

export KAM_AST_HOST="${KAM_AST_HOST:-blinkone-asterisk}"
export KAM_AST_PORT="${KAM_AST_PORT:-5060}"
export KAM_RTPENGINE_SOCK="${KAM_RTPENGINE_SOCK:-udp:blinkone-rtpengine:22222}"
export KAM_SIP_DOMAIN="${KAM_SIP_DOMAIN:-blinkone.local}"
export KAM_EXTERNAL_IP="${KAM_EXTERNAL_IP:-127.0.0.1}"

envsubst < /etc/kamailio/kamailio.cfg.tpl > /etc/kamailio/kamailio.cfg

exec "$@"
