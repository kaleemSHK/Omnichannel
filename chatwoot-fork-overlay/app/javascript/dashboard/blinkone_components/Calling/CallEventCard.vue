<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CallRecordingPlayer from './CallRecordingPlayer.vue';

const props = defineProps({
  event: { type: Object, required: true },
});
const { t } = useI18n();

const label = computed(() => {
  const key = `BLINKONE.CALLING.EVENT_${(props.event.eventType || 'unknown').toUpperCase()}`;
  const msg = t(key);
  return msg === key ? props.event.eventType : msg;
});

const time = computed(() => {
  const raw = props.event.occurredAt;
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return raw;
  }
});

const dotClass = computed(() => {
  const tpe = (props.event.eventType || '').toLowerCase();
  if (tpe.includes('ring') || tpe === 'incoming') return 'bg-ruby-500';
  if (tpe.includes('answer') || tpe === 'connected') return 'bg-teal-600';
  if (tpe.includes('transfer')) return 'bg-n-brand';
  return 'bg-n-slate-9';
});
</script>

<template>
  <div class="flex gap-2.5 py-1.5">
    <span class="size-2 rounded-full shrink-0 mt-1.5" :class="dotClass" />
    <div class="flex-1 min-w-0">
      <p class="text-xs font-medium text-n-slate-12">{{ label }}</p>
      <p class="text-[10px] text-n-slate-11">{{ time }}</p>
      <CallRecordingPlayer
        v-if="event.metadata?.recordingUrl"
        class="mt-2"
        :title="t('BLINKONE.CALLING.RECORDING')"
        :src="event.metadata.recordingUrl"
        :duration="event.metadata.duration || ''"
      />
    </div>
  </div>
</template>
