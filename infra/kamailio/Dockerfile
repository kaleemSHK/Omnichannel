FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    kamailio \
    kamailio-extra-modules \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY kamailio.cfg.tpl /etc/kamailio/kamailio.cfg.tpl
COPY did-map.yaml.example /etc/kamailio/did-map.yaml.example
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5060/udp 5060/tcp

ENTRYPOINT ["/entrypoint.sh"]
CMD ["kamailio", "-DD", "-E"]
