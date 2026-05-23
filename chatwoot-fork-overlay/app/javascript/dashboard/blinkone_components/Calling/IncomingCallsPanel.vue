<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import { useCallSession } from './useCallSession';
import IncomingCallCard from './IncomingCallCard.vue';
import CallingEmptyState from './CallingEmptyState.vue';
import CallingSegmentedControl from './CallingSegmentedControl.vue';

const { t } = useI18n();
const { calls } = useBlinkoneApi();
const { incomingCalls, refreshIncoming, callingPstnEnabled } = useCallSession();
const scope = ref('all');
const collapsed = ref(false);

const scopeOptions = [
  { value: 'all', label: t('BLINKONE.CALLING.SCOPE_ALL') },
  { value: 'mine', label: t('BLINKONE.CALLING.SCOPE_MINE') },
  { value: 'unassigned', label: t('BLINKONE.CALLING.SCOPE_UNASSIGNED') },
];

async function setScope(s) {
  scope.value = s;
  await refreshIncoming(s);
}

function screenPop(call) {
  if (call.conversationId && window.$router) {
    const accountId = call.chatwootAccountId || call.tenantId;
    window.$router.push({
      name: 'inbox_conversation',
      params: { accountId, conversation_id: call.conversationId },
    });
  }
}

async function onAccept(call) {
  await calls.answer(call.id, { agentId: call.assignedAgentId });
  screenPop(call);
  await refreshIncoming(scope.value);
}

async function onDecline(call) {
  await calls.decline(call.id, {});
  await refreshIncoming(scope.value);
}
</script>

<template>
  <section
    v-if="callingPstnEnabled"
    class="border-b border-n-weak bg-n-surface-1 shrink-0"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-n-solid-2 transition-colors"
      @click="collapsed = !collapsed"
    >
      <span class="flex items-center gap-2 text-sm font-medium text-n-slate-12">
        <span class="i-lucide-phone-incoming text-n-brand size-4" />
        {{ t('BLINKONE.CALLING.INCOMING_TITLE') }}
        <span
          v-if="incomingCalls.length"
          class="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-n-brand text-white text-[10px] font-semibold inline-flex items-center justify-center"
        >
          {{ incomingCalls.length }}
        </span>
      </span>
      <span
        class="i-lucide-chevron-down text-n-slate-11 size-4 transition-transform"
        :class="{ 'rotate-180': !collapsed }"
      />
    </button>

    <div v-show="!collapsed" class="px-3 pb-3">
      <CallingSegmentedControl
        :model-value="scope"
        :options="scopeOptions"
        class="mb-3 w-full flex justify-stretch [&>button]:flex-1"
        @update:model-value="setScope"
      />
      <div v-if="incomingCalls.length" class="rounded-lg border border-n-weak overflow-hidden bg-n-surface-1">
        <IncomingCallCard
          v-for="c in incomingCalls"
          :key="c.id"
          :call="c"
          @accept="onAccept"
          @decline="onDecline"
          @screen-pop="screenPop"
        />
      </div>
      <CallingEmptyState
        v-else
        icon="i-lucide-phone-incoming"
        :title="t('BLINKONE.CALLING.INCOMING_EMPTY')"
        :description="t('BLINKONE.CALLING.INCOMING_EMPTY_HINT')"
      />
    </div>
  </section>
</template>
