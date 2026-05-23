[rtpengine]
# Userspace-only in Docker (no rtpengine kernel module)
table = -1
interface = ${RTPENGINE_EXTERNAL_IP}
listen-ng = 0.0.0.0:22222
port-min = 30000
port-max = 30100
timeout = 60
silent-timeout = 3600
delete-delay = 30
foreground = true
log-stderr = true
