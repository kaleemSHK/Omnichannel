# Runbook: Tenant offboarding

1. Export data per [tenant-data-export.md](./tenant-data-export.md).
2. `POST /v1/tenants/{id}/suspend` — block logins.
3. Cancel subscription in billing; final invoice.
4. Delete MinIO prefix after retention period.
5. `DELETE` tenant row (cascade) — **irreversible**; requires platform_admin + second approver.
6. Remove Keycloak realm via integration SSO API.
7. Archive audit logs per legal retention (do not delete audit before 7 years if applicable).
