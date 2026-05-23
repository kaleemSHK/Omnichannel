<script setup>
import { computed, ref, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import { useCallSession } from './useCallSession';
import './calling-inbox.css';

const props = defineProps({
  conversationId: { type: [String, Number], default: null },
});
const { t } = useI18n();
const route = useRoute();
const { calls, callingInboxEnabled } = useBlinkoneApi();
const { activeCall, setActive } = useCallSession();
const elapsed = ref(0);
let timer = null;

const convId = computed(() => String(props.conversationId ?? route.params.conversationId ?? ''));
const session = computed(() => {
  const c = activeCall.value;
  if (!c || !convId.value) return null;
  return String(c.conversationId) === convId.value ? c : null;
});

const isRinging = computed(() => session.value?.status === 'ringing');
const isLive = computed(() => session.value?.status === 'connected');

const displayName = computed(
  () =>
    session.value?.metadata?.callerName ||
    session.value?.customerPhone ||
    t('BLINKONE.CALLING.UNKNOWN_CALLER'),
);

const transportLabel = computed(() => {
  const tr = (session.value?.transport || '').toLowerCase();
  if (tr === 'whatsapp') return t('BLINKONE.CALLING.CHANNEL_WHATSAPP');
  if (tr === 'pstn') return t('BLINKONE.CALLING.CHANNEL_PSTN');
  return tr;
});

watch(
  () => session.value?.status,
  s => {
    if (timer) clearInterval(timer);
    if (s === 'connected') {
      const start = new Date(session.value.connectedAt || Date.now()).getTime();
      const tick = () => {
        elapsed.value = Math.floor((Date.now() - start) / 1000);
      };
      tick();
      timer = setInterval(tick, 1000);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

async function accept() {
  await calls.answer(session.value.id, {});
  await setActive(session.value.id);
}
async function decline() {
  await calls.decline(session.value.id, {});
  activeCall.value = null;
}
async function hangup() {
  await calls.hangup(session.value.id, {});
  activeCall.value = null;
}
</script>

<template>
  <div
    v-if="callingInboxEnabled && session && (session.status === 'ringing' || session.status === 'connected')"
    class="shrink-0"
    :class="isRinging ? 'bg-ruby-50 border-b border-ruby-200 px-4 py-2.5 flex items-center gap-3' : 'b1-call-bar'"
  >
    <template v-if="isLive">
      <span class="b1-call-bar-dot" />
      <div class="flex-1 min-w-0">
        <div class="b1-call-bar-name">
          {{ displayName }} — {{ t('BLINKONE.CALLING.ACTIVE_CALL') }}
        </div>
        <div class="b1-call-bar-timer">
          {{ Math.floor(elapsed / 60) }}:{{ String(elapsed % 60).padStart(2, '0') }}
          &nbsp;·&nbsp; {{ transportLabel }}
        </div>
      </div>
      <div class="flex gap-1.5 shrink-0">
        <button type="button" class="b1-bar-btn" :title="t('BLINKONE.CALLING.MUTE')">
          <span class="i-lucide-mic-off size-4" />
        </button>
        <button type="button" class="b1-bar-btn" :title="t('BLINKONE.CALLING.HOLD')">
          <span class="i-lucide-pause size-4" />
        </button>
        <button type="button" class="b1-bar-btn" :title="t('BLINKONE.CALLING.TRANSFER')">
          <span class="i-lucide-phone-forward size-4" />
        </button>
        <button type="button" class="b1-bar-btn hangup" :title="t('BLINKONE.CALLING.END')" @click="hangup">
          <span class="i-lucide-phone-off size-4" />
        </button>
      </div>
    </template>
    <template v-else>
      <span class="size-2 rounded-full bg-ruby-500 animate-pulse shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-ruby-11">{{ displayName }}</p>
        <p class="text-xs text-n-slate-11">{{ t('BLINKONE.CALLING.STATUS_RINGING') }} · {{ transportLabel }}</p>
      </div>
      <div class="flex gap-1.5 shrink-0">
        <button
          type="button"
          class="b1-btn-sm b1-btn-answer"
          @click="accept"
        >
          {{ t('BLINKONE.CALLING.ACCEPT') }}
        </button>
        <button
          type="button"
          class="b1-btn-sm b1-btn-decline"
          @click="decline"
        >
          {{ t('BLINKONE.CALLING.DECLINE') }}
        </button>
      </div>
    </template>
  </div>
</template>
