\d recording_objects

SELECT cs.id, cs.status, cs.outcome, cs.tenant_id AS cs_tenant,
       ro.id AS ro_id, ro.storage_key, ro.tenant_id AS ro_tenant, ro.metadata
FROM call_sessions cs
LEFT JOIN recording_objects ro ON ro.call_session_id = cs.id AND ro.tenant_id = cs.tenant_id
WHERE cs.id = 'a47ca1c8-088a-4fa9-96a1-8b39787b4781';

SELECT cs.id, cs.status, ro.storage_key
FROM call_sessions cs
LEFT JOIN LATERAL (
  SELECT id, metadata, duration_ms, storage_key
  FROM recording_objects r
  WHERE r.call_session_id = cs.id AND r.tenant_id = cs.tenant_id
  ORDER BY (CASE WHEN r.storage_key IS NOT NULL AND r.storage_key <> '' THEN 0 ELSE 1 END), r.created_at DESC
  LIMIT 1
) ro ON TRUE
WHERE cs.id = 'a47ca1c8-088a-4fa9-96a1-8b39787b4781';
