SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app';

-- Simulate listCdr without tenant context
SELECT cs.id, ro.storage_key
FROM call_sessions cs
LEFT JOIN LATERAL (
  SELECT storage_key, metadata
  FROM recording_objects r
  WHERE r.call_session_id = cs.id AND r.tenant_id = cs.tenant_id
  LIMIT 1
) ro ON TRUE
WHERE cs.tenant_id = '1' AND cs.status IN ('ended', 'missed')
ORDER BY cs.started_at DESC
LIMIT 3;

-- With tenant context
BEGIN;
SELECT set_config('app.tenant_id', '1', true);
SELECT cs.id, ro.storage_key
FROM call_sessions cs
LEFT JOIN LATERAL (
  SELECT storage_key, metadata
  FROM recording_objects r
  WHERE r.call_session_id = cs.id AND r.tenant_id = cs.tenant_id
  LIMIT 1
) ro ON TRUE
WHERE cs.tenant_id = '1' AND cs.status IN ('ended', 'missed')
ORDER BY cs.started_at DESC
LIMIT 3;
COMMIT;
