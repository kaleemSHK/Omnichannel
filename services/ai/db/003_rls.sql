-- Prompt 8 RLS — REVIEW REQUIRED

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_provider_configs', 'ai_usage_events', 'stt_jobs',
    'rag_collections', 'rag_documents', 'rag_chunks',
    'voice_sessions', 'message_signals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

ALTER TABLE voice_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_turns FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON voice_turns;
CREATE POLICY tenant_isolation ON voice_turns
  USING (
    session_id IN (
      SELECT id FROM voice_sessions WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );
