# BlinkOne event catalog

Envelope shape (all bus events):

```json
{
  "id": "uuid",
  "type": "conversation.created",
  "tenant_id": "1",
  "occurred_at": "ISO-8601",
  "idempotency_key": "optional",
  "payload": {}
}
```

| event_type | Producer | Consumers |
|------------|----------|-----------|
| `conversation.created` | integration (Chatwoot webhook) | sla, tickets, outbound webhooks |
| `conversation.status_changed` | integration | sla, integration dispatch |
| `conversation.resolved` | gateway fan-out | sla, billing (usage), webhooks |
| `message.created` | integration | sla (agent response timer) |
| `usage.minute` | routing | billing |
| `usage.ai_token` | ai | billing |
| `usage.message` | gateway (planned) | billing |
| `sla.breached` | sla | escalation, webhooks |
| `integration.test` | integration admin | outbound webhooks |
| `psp.*.callback` | integration | billing |

Signing for outbound HTTP: `X-BlinkOne-Signature` — see [PROMPT10.md](./PROMPT10.md).
