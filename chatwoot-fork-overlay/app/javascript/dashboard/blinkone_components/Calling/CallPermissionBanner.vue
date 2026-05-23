<script setup>
import { useI18n } from 'vue-i18n';
import Button from 'dashboard/components-next/button/Button.vue';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';

const { t } = useI18n();
const { callingWhatsappEnabled } = useBlinkoneApi();
const emit = defineEmits(['request']);

function requestPermission() {
  emit('request');
}
</script>

<template>
  <div
    v-if="callingWhatsappEnabled"
    class="mx-4 my-2 p-3 rounded-lg border border-n-weak bg-n-solid-2 text-center text-sm"
  >
    <p class="text-n-slate-11 mb-2">{{ t('BLINKONE.CALLING.PERMISSION_REQUEST') }}</p>
    <Button size="sm" @click="requestPermission">{{ t('BLINKONE.CALLING.PERMISSION_REQUEST') }}</Button>
  </div>
</template>
