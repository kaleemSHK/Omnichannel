-- Demo call sessions for tenant 1 (blinkone_calling_inbox.html mock)
DELETE FROM call_events WHERE tenant_id = '1';
DELETE FROM call_sessions WHERE tenant_id = '1';

INSERT INTO call_sessions (
  id, tenant_id, room_id, channel, customer_phone, status, started_at, connected_at, ended_at,
  duration_ms, transport, direction, metadata
) VALUES
  (
    'a0000001-0001-4000-8000-000000000001',
    '1', 'demo-ring-1', 'voice', '+96892114401', 'ringing', now() - interval '30 seconds', NULL, NULL,
    NULL, 'whatsapp', 'inbound',
    '{"callerName":"Mohammed Al-Rashidi"}'::jsonb
  ),
  (
    'a0000001-0002-4000-8000-000000000002',
    '1', 'demo-live-1', 'voice', '+96892445512', 'connected', now() - interval '4 minutes', now() - interval '3 minutes 47 seconds', NULL,
    NULL, 'whatsapp', 'inbound',
    '{"callerName":"Fatima Al-Zahraa"}'::jsonb
  ),
  (
    'a0000001-0003-4000-8000-000000000003',
    '1', 'demo-missed-1', 'voice', '+9689211xxxx', 'missed', now() - interval '10 minutes', NULL, now() - interval '8 minutes',
    NULL, 'pstn', 'inbound',
    '{"callerName":"Samir Al-Oman"}'::jsonb
  ),
  (
    'a0000001-0004-4000-8000-000000000004',
    '1', 'demo-ended-1', 'voice', '+96899002211', 'ended', now() - interval '20 minutes', now() - interval '18 minutes', now() - interval '15 minutes 29 seconds',
    151000, 'pstn', 'inbound',
    '{"callerName":"Khalid Hassan"}'::jsonb
  );

INSERT INTO call_events (tenant_id, call_session_id, event_type, metadata, occurred_at) VALUES
  ('1', 'a0000001-0001-4000-8000-000000000001', 'incoming', '{"transport":"whatsapp"}', now() - interval '30 seconds'),
  ('1', 'a0000001-0002-4000-8000-000000000002', 'incoming', '{"transport":"whatsapp"}', now() - interval '4 minutes'),
  ('1', 'a0000001-0002-4000-8000-000000000002', 'answered', '{"agentName":"Sarah Al-Hinai"}', now() - interval '3 minutes 51 seconds'),
  ('1', 'a0000001-0002-4000-8000-000000000002', 'connected', '{}', now() - interval '3 minutes 47 seconds'),
  ('1', 'a0000001-0003-4000-8000-000000000003', 'incoming', '{"transport":"pstn"}', now() - interval '10 minutes'),
  ('1', 'a0000001-0003-4000-8000-000000000003', 'missed', '{}', now() - interval '8 minutes'),
  ('1', 'a0000001-0004-4000-8000-000000000004', 'incoming', '{"transport":"pstn"}', now() - interval '20 minutes'),
  ('1', 'a0000001-0004-4000-8000-000000000004', 'answered', '{"agentName":"Sarah Al-Hinai"}', now() - interval '18 minutes'),
  ('1', 'a0000001-0004-4000-8000-000000000004', 'ended', '{"duration":"2:31"}', now() - interval '15 minutes 29 seconds');
