<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';

const { t } = useI18n();
const { callingPstnEnabled, callingWhatsappEnabled } = useBlinkoneApi();
const channel = ref(callingPstnEnabled.value ? 'pstn' : 'whatsapp');
const emit = defineEmits(['dial']);
</script>

<template>
  <div
    v-if="callingPstnEnabled || callingWhatsappEnabled"
    class="inline-flex items-center gap-1 shrink-0"
  >
    <button
      type="button"
      class="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-n-slate-12 border border-n-weak bg-n-surface-1 hover:bg-n-solid-2 transition-colors"
      :title="t('BLINKONE.CALLING.START_CALL')"
      @click="emit('dial', { transport: channel })"
    >
      <span class="i-lucide-phone size-4 text-n-brand" />
      <span class="hidden sm:inline">{{ t('BLINKONE.CALLING.START_CALL') }}</span>
    </button>
  </div>
</template>
