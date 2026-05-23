# BlinkOne — Asterisk 20 (PJSIP + ARI + WebRTC WSS)
FROM andrius/asterisk:20

USER root
RUN apt-get update && apt-get install -y --no-install-recommends gettext-base curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY config/ /etc/asterisk-templates/
COPY scripts/entrypoint.sh /entrypoint.sh
COPY scripts/generate-dtls-certs.sh /usr/local/bin/generate-dtls-certs.sh
RUN chmod +x /entrypoint.sh /usr/local/bin/generate-dtls-certs.sh

RUN mkdir -p /var/spool/asterisk/recordings /etc/asterisk/generated /var/lib/asterisk/certs \
    && chown -R asterisk:asterisk /var/spool/asterisk /var/lib/asterisk/certs /etc/asterisk/generated

EXPOSE 5060/udp 5060/tcp 5061/tcp 8088/tcp 8089/tcp 10000-10100/udp

# Entrypoint renders configs as root, then drops to asterisk
USER root
ENTRYPOINT ["/entrypoint.sh"]
CMD ["asterisk", "-f", "-vvv"]
