<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';

const { t } = useI18n();
const { calls } = useBlinkoneApi();
const live = ref([]);

onMounted(async () => {
  live.value = await calls.list({ status: 'ringing,connected' });
});
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.TELEPHONY.CALLS_MONITOR.TITLE')"
      :description="t('BLINKONE.TELEPHONY.CALLS_MONITOR.DESCRIPTION')"
    />
    <table class="w-full text-sm border border-n-weak rounded-lg overflow-hidden">
      <thead class="bg-n-solid-2 text-left">
        <tr>
          <th class="p-2">ID</th>
          <th class="p-2">Status</th>
          <th class="p-2">Phone</th>
          <th class="p-2">Transport</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in live" :key="c.id" class="border-t border-n-weak">
          <td class="p-2 font-mono text-xs">{{ c.id }}</td>
          <td class="p-2">{{ c.status }}</td>
          <td class="p-2">{{ c.customerPhone || '—' }}</td>
          <td class="p-2">{{ c.transport }}</td>
        </tr>
      </tbody>
    </table>
  </SettingsLayout>
</template>
