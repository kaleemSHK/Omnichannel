<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import { useCallSession } from './useCallSession';
import CallListRow from './CallListRow.vue';
import CallingEmptyState from './CallingEmptyState.vue';
import { DEMO_CALLS } from './demoCallsFixture';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { calls, callingInboxEnabled } = useBlinkoneApi();
const { incomingCalls, refreshIncoming, setActive, activeCall } = useCallSession();

const allCalls = ref([]);
const loading = ref(false);
const selectedId = ref(null);
const useDemo = ref(false);

async function loadCalls() {
  if (!callingInboxEnabled.value) return;
  loading.value = true;
  useDemo.value = false;
  try {
    await refreshIncoming('all');
    const history = await calls.list({ status: 'ringing,connected,ended,missed' });
    const byId = new Map();
    for (const c of [...incomingCalls.value, ...history]) {
      byId.set(c.id, c);
    }
    allCalls.value = [...byId.values()];
    if (!allCalls.value.length) {
      allCalls.value = [...DEMO_CALLS];
      useDemo.value = true;
    }
  } catch {
    allCalls.value = [...DEMO_CALLS];
    useDemo.value = true;
  } finally {
    loading.value = false;
  }
}

const sortedCalls = computed(() => {
  const order = { ringing: 0, connected: 1, missed: 2, ended: 3 };
  return [...allCalls.value].sort((a, b) => {
    const da = order[a.status] ?? 9;
    const db = order[b.status] ?? 9;
    if (da !== db) return da - db;
    return new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
  });
});

const ringingCount = computed(() => allCalls.value.filter(c => c.status === 'ringing').length);

function screenPop(call) {
  selectedId.value = call.id;
  if (call.conversationId) {
    router.push({
      name: 'inbox_conversation',
      params: {
        accountId: route.params.accountId,
        conversation_id: call.conversationId,
      },
    });
  }
}

async function onAccept(call) {
  if (useDemo.value) {
    screenPop(call);
    return;
  }
  await calls.answer(call.id, { agentId: call.assignedAgentId });
  await setActive(call.id);
  screenPop(call);
  await loadCalls();
}

async function onDecline(call) {
  if (useDemo.value) {
    allCalls.value = allCalls.value.filter(c => c.id !== call.id);
    return;
  }
  await calls.decline(call.id, {});
  await loadCalls();
}

watch(
  () => activeCall.value?.id,
  id => {
    if (id) selectedId.value = id;
  },
);

onMounted(loadCalls);

defineExpose({ reload: loadCalls, ringingCount });
</script>

<template>
  <div class="b1-call-list flex flex-col min-h-0">
    <div v-if="loading" class="py-10 flex justify-center">
      <span class="size-6 rounded-full border-2 border-[#0B5FFF] border-t-transparent animate-spin" />
    </div>
    <template v-else>
      <p
        v-if="useDemo"
        class="mx-3 mt-2 mb-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1"
      >
        {{ t('BLINKONE.CALLING.DEMO_PREVIEW') }}
      </p>
      <CallListRow
        v-for="c in sortedCalls"
        :key="c.id"
        :call="c"
        :active="selectedId === c.id || activeCall?.id === c.id"
        @select="screenPop"
        @accept="onAccept"
        @decline="onDecline"
      />
      <CallingEmptyState
        v-if="!sortedCalls.length"
        icon="i-lucide-phone"
        :title="t('BLINKONE.CALLING.HISTORY_EMPTY')"
        :description="t('BLINKONE.CALLING.HISTORY_EMPTY_HINT')"
      />
    </template>
  </div>
</template>
