import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';

const activeCall = ref(null);
const incomingCalls = ref([]);
const sessionReady = ref(false);
let pollTimer = null;
let cable = null;
let subscribers = 0;
let initialized = false;
let callsApi = null;
let inboxEnabled = null;

async function refreshIncoming(scope = 'all') {
  if (!inboxEnabled?.value || !callsApi) return;
  try {
    incomingCalls.value = await callsApi.listIncoming(scope);
  } catch {
    incomingCalls.value = [];
  }
}

export function useCallSession() {
  const { calls, tenantId, callingInboxEnabled, loadFeatures } = useBlinkoneApi();
  callsApi = calls;
  inboxEnabled = callingInboxEnabled;

  const hasActiveCall = computed(() => !!activeCall.value);
  const isRinging = computed(() => activeCall.value?.status === 'ringing');

  async function setActive(id) {
    if (!id) {
      activeCall.value = null;
      return;
    }
    try {
      activeCall.value = await calls.get(id);
    } catch {
      activeCall.value = null;
    }
  }

  function subscribeCable(accountId) {
    if (!window.actionCable || !accountId || cable) return;
    try {
      cable = window.actionCable.subscriptions.create(
        { channel: 'BlinkoneCallChannel', account_id: accountId },
        {
          received(data) {
            if (data.type === 'incoming') refreshIncoming();
            if (data.type === 'answered' && data.callId) setActive(data.callId);
            if (data.type === 'ended' && activeCall.value?.id === data.callId) activeCall.value = null;
            if (data.type === 'declined') refreshIncoming();
          },
        },
      );
    } catch {
      /* optional */
    }
  }

  onMounted(async () => {
    subscribers += 1;
    if (initialized) return;
    initialized = true;
    await loadFeatures();
    sessionReady.value = true;
    if (callingInboxEnabled.value) {
      await refreshIncoming();
      pollTimer = setInterval(() => refreshIncoming(), 5000);
      subscribeCable(tenantId.value);
    }
  });

  onUnmounted(() => {
    subscribers -= 1;
    if (subscribers <= 0) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (cable) {
        cable.unsubscribe();
        cable = null;
      }
      initialized = false;
    }
  });

  return {
    activeCall,
    incomingCalls,
    hasActiveCall,
    isRinging,
    sessionReady,
    callingInboxEnabled,
    refreshIncoming,
    setActive,
  };
}
