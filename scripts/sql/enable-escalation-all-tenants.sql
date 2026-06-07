-- Enable escalation feature for every tenant (idempotent).
INSERT INTO tenant_features (tenant_id, feature_key, enabled, config)
SELECT t.id, 'escalation', true, '{}'::jsonb
FROM tenants t
ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled = true;
