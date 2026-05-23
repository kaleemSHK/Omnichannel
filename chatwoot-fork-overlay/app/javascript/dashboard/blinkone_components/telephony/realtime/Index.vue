<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import BlinkoneFeatureGate from 'dashboard/blinkone_components/BlinkoneFeatureGate.vue';

const { t } = useI18n();
const { routing } = useBlinkoneApi();
const data = ref(null);
let timer;
let ws;

async function refresh() {
  data.value = await routing.realtime();
}

function connectWs() {
  try {
    ws = new WebSocket(routing.realtimeWsUrl());
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'realtime') data.value = msg.data;
    };
    ws.onclose = () => {
      timer = setInterval(refresh, 2000);
    };
  } catch {
    timer = setInterval(refresh, 2000);
  }
}

onMounted(() => {
  refresh();
  connectWs();
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (ws) ws.close();
});
</script>

<template>
  <BlinkoneFeatureGate feature="telephony.supervisor">
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.TELEPHONY.REALTIME.TITLE')"
      :description="t('BLINKONE.TELEPHONY.REALTIME.DESCRIPTION')"
    />
    <div v-if="data" class="grid grid-cols-4 gap-3 mb-6">
      <div class="rounded-lg border border-n-weak p-4 text-center">
        <div class="text-2xl font-semibold text-n-teal-11">{{ data.agents.available }}</div>
        <div class="text-sm text-n-slate-11">{{ t('BLINKONE.TELEPHONY.ROUTING.AVAILABLE') }}</div>
      </div>
      <div class="rounded-lg border border-n-weak p-4 text-center">
        <div class="text-2xl font-semibold text-n-brand">{{ data.agents.busy }}</div>
        <div class="text-sm text-n-slate-11">{{ t('BLINKONE.TELEPHONY.ROUTING.BUSY') }}</div>
      </div>
      <div class="rounded-lg border border-n-weak p-4 text-center">
        <div class="text-2xl font-semibold text-n-amber-11">{{ data.totalWaiting }}</div>
        <div class="text-sm text-n-slate-11">{{ t('BLINKONE.TELEPHONY.ROUTING.WAITING') }}</div>
      </div>
      <div class="rounded-lg border border-n-weak p-4 text-center">
        <div class="text-2xl font-semibold">{{ data.queues?.length || 0 }}</div>
        <div class="text-sm text-n-slate-11">{{ t('BLINKONE.TELEPHONY.REALTIME.QUEUES') }}</div>
      </div>
    </div>
    <div v-if="data?.queues" class="space-y-2">
      <div
        v-for="q in data.queues"
        :key="q.queueId"
        class="rounded-lg border border-n-weak p-3 flex justify-between text-sm"
      >
        <span>{{ q.name }} ({{ q.queueKey }})</span>
        <span class="text-n-slate-11">{{ q.waiting }} waiting</span>
      </div>
    </div>
  </SettingsLayout>
  </BlinkoneFeatureGate>
</template>
