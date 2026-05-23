# Agent Assist — conversation sidebar

Component: `chatwoot-fork-overlay/app/javascript/dashboard/blinkone_components/AgentAssist/AgentAssistPanel.vue`

After copying the overlay into your Chatwoot fork, mount the panel in the conversation sidebar (e.g. next to contact details):

```vue
<AgentAssistPanel
  :conversation-id="currentChat.id"
  :transcript="conversationTranscript"
/>
```

Import:

```js
import AgentAssistPanel from 'dashboard/blinkone_components/AgentAssist/AgentAssistPanel.vue';
```

Build `conversationTranscript` from the last N messages in the store (customer + agent text). Requires `AI_TOKEN` in the Chatwoot container env (same as gateway).
