-- Allow WebRTC ACD / mobile-app-to-agent calls in call_sessions.transport
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS call_sessions_transport_check;
ALTER TABLE call_sessions ADD CONSTRAINT call_sessions_transport_check
  CHECK (transport IN ('pstn', 'whatsapp', 'webrtc'));
