# Runbook: Asterisk crash recovery

## Symptoms

Inbound calls fail; ARI disconnects; routing shows no active channels.

## Steps

1. `docker compose ps asterisk` — restart: `docker compose restart asterisk`.
2. Check logs: `docker compose logs asterisk --tail 200`.
3. Verify Kamailio registration: `docker compose logs kamailio`.
4. Confirm routing ARI reconnects (`/v1/health` on routing).
5. Place test call via SIPP or manual SIP client.

## Escalation

If corrupt spool: restore from last backup; replay missing CDR from AMI logs.
