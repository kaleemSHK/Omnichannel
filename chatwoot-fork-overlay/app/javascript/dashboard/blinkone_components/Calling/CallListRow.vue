<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CallChannelAvatar from './CallChannelAvatar.vue';

const props = defineProps({
  call: { type: Object, required: true },
  active: { type: Boolean, default: false },
});
const emit = defineEmits(['accept', 'decline', 'select']);
const { t } = useI18n();

const displayName = computed(
  () =>
    props.call.metadata?.callerName ||
    props.call.customerPhone ||
    props.call.roomId ||
    t('BLINKONE.CALLING.UNKNOWN_CALLER'),
);

const transportLabel = computed(() => {
  const tr = (props.call.transport || '').toLowerCase();
  if (tr === 'whatsapp') return 'WhatsApp';
  if (tr === 'pstn') return 'PSTN';
  return tr || 'Voice';
});

const subTime = computed(() => {
  if (props.call.status === 'connected' && props.call.connectedAt) {
    const sec = Math.floor((Date.now() - new Date(props.call.connectedAt).getTime()) / 1000);
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
  const raw = props.call.endedAt || props.call.startedAt;
  if (!raw) return '';
  const diff = Date.now() - new Date(raw).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  return new Date(raw).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
});

const durationEnded = computed(() => {
  if (props.call.durationMs) {
    const sec = Math.floor(props.call.durationMs / 1000);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  return '';
});

const rowClass = computed(() => {
  const parts = ['b1-call-row'];
  if (props.call.status === 'ringing') parts.push('ringing');
  if (props.active || props.call.status === 'connected') parts.push('active');
  return parts.join(' ');
});
</script>

<template>
  <div :class="rowClass" @click="emit('select', call)">
    <CallChannelAvatar :call="call" size="sm" />
    <div class="flex-1 min-w-0">
      <div class="text-[13px] font-medium text-n-slate-12 truncate">
        {{ displayName }}
      </div>
      <div class="flex gap-1.5 items-center mt-0.5 flex-wrap">
        <span v-if="call.status === 'ringing'" class="b1-badge b1-badge-ring">
          <span class="i-lucide-phone-incoming size-2.5" />
          {{ t('BLINKONE.CALLING.STATUS_RINGING_SHORT') }}
        </span>
        <span v-else-if="call.status === 'connected'" class="b1-badge b1-badge-live">
          <span class="i-lucide-circle size-2 fill-current" />
          {{ t('BLINKONE.CALLING.STATUS_LIVE') }}
        </span>
        <span v-else-if="call.status === 'missed'" class="b1-badge b1-badge-missed">
          <span class="i-lucide-phone-missed size-2.5" />
          {{ t('BLINKONE.CALLING.STATUS_MISSED') }}
        </span>
        <span v-else class="b1-badge b1-badge-ended">{{ t('BLINKONE.CALLING.STATUS_ENDED') }}</span>
        <span class="text-[10px] text-n-slate-11">
          <template v-if="call.status === 'ended' && durationEnded">{{ durationEnded }} · </template>
          {{ subTime }}
        </span>
      </div>
      <div class="mt-0.5 flex flex-wrap gap-1 items-center">
        <span v-if="call.transport === 'whatsapp'" class="b1-badge b1-badge-wa">WhatsApp</span>
        <span v-else class="text-[10px] text-n-slate-11">
          {{ transportLabel }}
          <template v-if="call.customerPhone"> · {{ call.customerPhone }}</template>
        </span>
      </div>
      <div
        v-if="call.status === 'ringing'"
        class="flex gap-1 mt-1"
        @click.stop
      >
        <button type="button" class="b1-btn-sm b1-btn-answer" @click="emit('accept', call)">
          <span class="i-lucide-phone size-2.5 inline-block mr-0.5" />
          {{ t('BLINKONE.CALLING.ACCEPT') }}
        </button>
        <button type="button" class="b1-btn-sm b1-btn-decline" @click="emit('decline', call)">
          <span class="i-lucide-phone-off size-2.5 inline-block mr-0.5" />
          {{ t('BLINKONE.CALLING.DECLINE') }}
        </button>
      </div>
    </div>
  </div>
</template>
