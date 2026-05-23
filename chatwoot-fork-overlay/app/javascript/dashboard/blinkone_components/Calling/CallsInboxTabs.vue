<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import { useCallSession } from './useCallSession';
import CallsListPanel from './CallsListPanel.vue';
import './calling-inbox.css';

const { t } = useI18n();
const { callingInboxEnabled } = useBlinkoneApi();
const { incomingCalls } = useCallSession();
const tab = ref('chats');
let listRoot = null;

const ringingBadge = computed(() => incomingCalls.value.length);

function bindListRoot() {
  listRoot = document.querySelector('.conversations-list-wrap');
}

function applyTab() {
  if (typeof window !== 'undefined') window.blinkoneCallsTab = tab.value;
  if (!listRoot) bindListRoot();
  const onCalls = tab.value === 'calls';
  if (typeof document !== 'undefined') {
    document.body.classList.toggle('b1-calls-inbox-view', onCalls);
  }
  if (listRoot) {
    listRoot.classList.toggle('!hidden', onCalls);
  }
}

function setTab(next) {
  tab.value = next;
}

watch(tab, applyTab, { immediate: true });

onMounted(() => {
  bindListRoot();
  applyTab();
});

onUnmounted(() => {
  if (listRoot) listRoot.classList.remove('!hidden');
  if (typeof document !== 'undefined') document.body.classList.remove('b1-calls-inbox-view');
});
</script>

<template>
  <div
    v-if="callingInboxEnabled"
    class="b1-calls-inbox-shell flex flex-col flex-shrink-0 min-h-0 bg-n-surface-1 border-b border-n-weak z-[5]"
    :class="{ 'flex-1': tab === 'calls' }"
  >
    <div class="px-3.5 pt-3 pb-0">
      <div class="text-[13px] font-medium text-n-slate-12 mb-2">
        {{ t('BLINKONE.CALLING.INBOX_TITLE') }}
      </div>
      <div class="b1-calling-inbox-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="b1-tab"
          :class="{ active: tab === 'chats' }"
          :aria-selected="tab === 'chats'"
          @click="setTab('chats')"
        >
          {{ t('BLINKONE.CALLING.CHATS_TAB') }}
        </button>
        <button
          type="button"
          role="tab"
          class="b1-tab"
          :class="{ active: tab === 'calls' }"
          :aria-selected="tab === 'calls'"
          @click="setTab('calls')"
        >
          {{ t('BLINKONE.CALLING.CALLS_TAB') }}
          <span v-if="ringingBadge" class="b1-calls-badge">{{ ringingBadge }}</span>
        </button>
      </div>
    </div>
    <div
      v-show="tab === 'calls'"
      class="flex flex-col flex-1 min-h-0 max-h-[min(70vh,640px)] overflow-hidden"
    >
      <CallsListPanel />
    </div>
  </div>
</template>
