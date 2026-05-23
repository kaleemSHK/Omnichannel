<script setup>
import { ref, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  call: { type: Object, required: true },
});
const { t } = useI18n();
const { calls } = useBlinkoneApi();
const elapsed = ref(0);
let timer = null;

watch(
  () => props.call.status,
  s => {
    if (timer) clearInterval(timer);
    if (s === 'connected') {
      const start = new Date(props.call.connectedAt || Date.now()).getTime();
      timer = setInterval(() => {
        elapsed.value = Math.floor((Date.now() - start) / 1000);
      }, 1000);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

async function endCall() {
  await calls.hangup(props.call.id, {});
}
</script>

<template>
  <div class="rounded-xl border border-n-brand/40 bg-gradient-to-br from-n-brand/5 to-n-solid-2 p-3 shadow-sm">
    <div class="flex items-center gap-3 mb-3">
      <span class="flex items-center justify-center size-10 rounded-full bg-n-brand text-white">
        <span class="i-lucide-phone size-5" />
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-n-slate-12 truncate">
          {{ call.customerPhone || call.roomId }}
        </p>
        <p class="text-xs text-n-brand font-medium">{{ t('BLINKONE.CALLING.CONNECTED') }}</p>
      </div>
      <span class="font-mono text-sm text-n-slate-12 tabular-nums">
        {{ Math.floor(elapsed / 60) }}:{{ String(elapsed % 60).padStart(2, '0') }}
      </span>
    </div>
    <Button size="sm" variant="outline" color="ruby" class="w-full" @click="endCall">
      <span class="i-lucide-phone-off size-3.5 mr-1" />
      {{ t('BLINKONE.CALLING.END') }}
    </Button>
  </div>
</template>
