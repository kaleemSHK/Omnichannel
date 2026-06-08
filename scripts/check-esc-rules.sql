SELECT name, trigger, conditions::text
FROM escalation_rules
WHERE name IN ('Priority urgent', 'Abandoned call', 'Long queue wait');
