<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'dashboard/components-next/button/Button.vue';
import CallChannelAvatar from './CallChannelAvatar.vue';
import CallStatusBadge from './CallStatusBadge.vue';

const props = defineProps({
  call: { type: Object, required: true },
  active: { type: Boolean, default: false },
});
const emit = defineEmits(['accept', 'decline', 'screen-pop']);
const { t } = useI18n();

const rowClass = computed(() => {
  const base =
    'flex gap-3 px-3 py-2.5 cursor-pointer border-l-[3px] transition-colors';
  if (props.call.status === 'ringing') {
    return `${base} border-l-ruby-500 hover:bg-ruby-50/50 animate-pulse`;
  }
  if (props.active || props.call.status === 'connected') {
    return `${base} border-l-n-brand bg-n-brand/5`;
  }
  return `${base} border-l-transparent hover:bg-n-solid-2`;
});
</script>

<template>
  <div :class="rowClass" @click="emit('screen-pop', call)">
    <CallChannelAvatar :call="call" />
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-n-slate-12 truncate">
        {{ call.customerPhone || call.metadata?.callerName || call.roomId }}
      </p>
      <div class="flex flex-wrap items-center gap-1.5 mt-1">
        <CallStatusBadge :status="call.status" />
      </div>
      <p
        v-if="call.metadata?.transferFrom"
        class="flex items-center gap-1 text-xs text-n-brand mt-1"
      >
        <span class="i-lucide-phone-forward size-3" />
        {{ t('BLINKONE.CALLING.TRANSFER_FROM', { name: call.metadata.transferFrom }) }}
      </p>
      <div
        v-if="call.status === 'ringing'"
        class="flex gap-2 mt-2"
        @click.stop
      >
        <Button size="sm" color="teal" class="!text-xs" @click="emit('accept', call)">
          {{ t('BLINKONE.CALLING.ACCEPT') }}
        </Button>
        <Button size="sm" variant="outline" color="ruby" class="!text-xs" @click="emit('decline', call)">
          {{ t('BLINKONE.CALLING.DECLINE') }}
        </Button>
      </div>
    </div>
  </div>
</template>
