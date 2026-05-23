#!/bin/sh
set -eu
export RTPENGINE_EXTERNAL_IP="${RTPENGINE_EXTERNAL_IP:-127.0.0.1}"
envsubst < /etc/rtpengine/rtpengine.conf.tpl > /etc/rtpengine/rtpengine.conf
exec "$@"
