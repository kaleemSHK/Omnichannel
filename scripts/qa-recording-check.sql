SELECT ro.id, ro.storage_key, ro.storage_backend, ro.metadata::text, cs.started_at
FROM recording_objects ro
JOIN call_sessions cs ON cs.id = ro.call_session_id
ORDER BY ro.created_at DESC
LIMIT 8;
