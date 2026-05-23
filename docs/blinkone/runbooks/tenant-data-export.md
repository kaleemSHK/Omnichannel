# Runbook: Tenant data export (GDPR-style)

## Request intake

Verify identity of tenant admin; log ticket in audit.

## Export scope

- Chatwoot: conversations, contacts, attachments (Platform API export).
- Sidecars: Postgres rows for `tenant_id` (IVR, SLA, routing CDR, audit).
- Recordings: MinIO prefix `tenants/{id}/recordings/`.

## Procedure

1. Set read-only maintenance window optional.
2. Run SQL exports with `SET app.tenant_id = '<id>'` under RLS.
3. Bundle encrypted ZIP; deliver via secure link (24h expiry).
4. Record `audit.data_export` event.

## Timeline

Standard: 5 business days. Large tenants: 15 days.
