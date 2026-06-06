SELECT cs.id,
       cs.metadata->>'recordingId' AS rec_id,
       ro.storage_key,
       cs.started_at
FROM call_sessions cs
LEFT JOIN LATERAL (
  SELECT storage_key
  FROM recording_objects r
  WHERE r.call_session_id = cs.id
  ORDER BY r.created_at DESC
  LIMIT 1
) ro ON TRUE
WHERE cs.started_at > now() - interval '6 hours'
ORDER BY cs.started_at DESC
LIMIT 10;
