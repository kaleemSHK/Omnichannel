SELECT id, storage_key, call_session_id, created_at
FROM recording_objects
ORDER BY created_at DESC
LIMIT 8;

SELECT id, started_at, outcome, transport, metadata->>'recordingId' AS meta_rec
FROM call_sessions
WHERE started_at > now() - interval '3 hours'
ORDER BY started_at DESC
LIMIT 12;
