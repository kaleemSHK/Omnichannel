# Runbook: Recording bucket full

## Symptoms

MinIO disk alert; new recordings fail; CDR shows `storage_error`.

## Steps

1. Confirm usage: MinIO console or `mc du local/recordings`.
2. Apply retention policy per tenant (default 90 days — confirm contract).
3. Run cleanup job (TODO: `scripts/blinkone/prune-recordings.mjs`) for objects older than retention.
4. Expand volume or add lifecycle rule to cold storage.
5. Notify tenants if legal hold applies before delete.

## Prevention

Monitor `minio_cluster_disk_free_bytes` alert at 15% free.
