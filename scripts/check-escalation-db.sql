SELECT r.id, r.name, r.trigger, r.enabled, rs.tenant_id,
  (SELECT count(*)::int FROM escalation_rule_runs rr WHERE rr.rule_id = r.id) AS runs
FROM escalation_rules r
JOIN escalation_rulesets rs ON rs.id = r.ruleset_id
ORDER BY r.id;

SELECT count(*)::int AS watch_rows FROM escalation_conversation_watch;
SELECT count(*)::int AS total_runs FROM escalation_rule_runs;
