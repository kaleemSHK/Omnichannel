# BlinkOne mock UI → Chatwoot CE integration map

Reference HTML lives in `e:\BlinkOne-Mock\`. **Do not copy layouts 1:1** — use Chatwoot CE v4.13 chrome (`n-*` tokens, `components-next/Button`, existing sidebar / conversation / settings shells).

## Agent inbox (conversation workspace)

| Mock file | Intent | Chatwoot mount |
|-----------|--------|----------------|
| `blinkone_calling_inbox.html` | Chats \| Calls tabs, call list rows, active call bar, thread activity card, right **Call** timeline + recording cards | `ChatList.vue` + `ConversationBox` + `ContactPanel` accordion (`CallActivitiesSection`) |
| `blinkone_agent_assist_panel.html` | AI suggestions beside conversation | `AgentAssistPanel.vue` (conversation context) |
| `blinkone_phone_panel_softphone.html` | Agent softphone, presence, dialpad | Settings → `PhonePanel.vue` (not inbox) |

### Calling inbox patterns (from mock)

- **Tabs:** underline Chats \| Calls (badge on Calls when ringing)
- **Call list:** left accent border (ringing pulse / active brand), channel-colored avatar, status pills
- **Active call bar:** green strip above thread; circular mute / hold / transfer / end
- **Thread:** system activity card for call events (not raw HTML5 audio chrome)
- **Right panel:** Call activity timeline + styled recording rows

## Admin / settings (SettingsLayout)

| Mock file | Route |
|-----------|--------|
| `blinkone_routing_realtime_dashboard.html` | `settings/blinkone/telephony/realtime` |
| `blinkone_ivr_builder.html` | `settings/blinkone/ivr` |
| `blinkone_escalation_rules.html` | `settings/blinkone/escalation` |
| `blinkone_sla_dashboard.html` | `settings/blinkone/sla/dashboard` |
| `blinkone_billing_admin.html` | `settings/blinkone/billing` |
| `blinkone_platform_admin_tenants.html` | `settings/blinkone/platform/tenants` |

Patches: `scripts/blinkone/patch-chatwoot-telephony.mjs`, `patch-chatwoot-calling-inbox.mjs`.

## Design tokens (mock → Chatwoot)

| Mock | Chatwoot utility |
|------|------------------|
| Primary blue `#0B5FFF` | `text-n-brand`, `bg-n-brand`, `border-n-brand` |
| Success green bar | `bg-teal-50`, `border-teal-200`, `text-teal-11` (dark: `teal-950/30`) |
| Ringing red | `border-ruby-500`, `text-ruby-11`, `bg-ruby-50` |
| Muted text | `text-n-slate-11` |
| Cards / borders | `border-n-weak`, `bg-n-surface-1`, `rounded-lg` |
