#!/usr/bin/env bash
set -euo pipefail
cd /opt/blinkone
docker compose build sla routing
docker compose up -d sla routing escalation tenant
echo "P0 escalation event wiring deployed."
