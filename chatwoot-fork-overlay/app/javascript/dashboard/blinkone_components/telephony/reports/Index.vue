<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { routing } = useBlinkoneApi();
const report = ref(null);

async function load() {
  report.value = await routing.agentReports();
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.TELEPHONY.REPORTS.TITLE')"
      :description="t('BLINKONE.TELEPHONY.REPORTS.DESCRIPTION')"
    />
    <Button class="mb-4" :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
    <div v-if="report" class="space-y-2">
      <div
        v-for="a in report.agents"
        :key="a.agentId"
        class="rounded-lg border border-n-weak p-3 flex justify-between text-sm"
      >
        <span class="font-medium">{{ a.agentId }}</span>
        <span class="text-n-slate-11">
          {{ t('BLINKONE.TELEPHONY.REPORTS.HANDLED', { n: a.handled }) }}
        </span>
      </div>
      <p v-if="!report.agents?.length" class="text-sm text-n-slate-11">
        {{ t('BLINKONE.TELEPHONY.REPORTS.EMPTY') }}
      </p>
    </div>
  </SettingsLayout>
</template>
