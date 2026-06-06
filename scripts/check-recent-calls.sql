SELECT id, started_at, duration_ms, outcome, status, transport,
       customer_phone, metadata->>'callerName' AS caller,
       metadata->>'recordingId' AS rec
FROM call_sessions
WHERE started_at > '2026-06-02 22:55:00+00'
ORDER BY started_at DESC;
