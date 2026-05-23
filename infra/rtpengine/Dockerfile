FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    rtpengine-daemon \
    rtpengine-utils \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY rtpengine.conf.tpl /etc/rtpengine/rtpengine.conf.tpl
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 22222/udp 30000-30100/udp

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/rtpengine", "--config-file=/etc/rtpengine/rtpengine.conf", "--foreground", "--log-stderr"]
