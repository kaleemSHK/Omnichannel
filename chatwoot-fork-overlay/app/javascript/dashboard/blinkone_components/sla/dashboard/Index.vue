<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import BlinkoneFeatureGate from 'dashboard/blinkone_components/BlinkoneFeatureGate.vue';

const { t } = useI18n();
const { sla } = useBlinkoneApi();
const dash = ref(null);

async function load() {
  dash.value = await sla.dashboard();
}

onMounted(load);
</script>

<template>
  <BlinkoneFeatureGate feature="sla">
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.SLA.DASHBOARD.TITLE')"
      :description="t('BLINKONE.SLA.DASHBOARD.DESCRIPTION')"
    />
    <Button class="mb-4" :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
    <div v-if="dash" class="grid md:grid-cols-3 gap-4">
      <section class="rounded-lg border border-n-weak p-4">
        <h3 class="text-xs uppercase text-n-slate-11 mb-2">{{ t('BLINKONE.SLA.DASHBOARD.AT_RISK') }}</h3>
        <div v-for="i in dash.atRisk" :key="i.id" class="text-sm py-1">
          #{{ i.conversationId }} — {{ i.targetType }} due {{ i.dueAt }}
        </div>
        <p v-if="!dash.atRisk?.length" class="text-xs text-n-slate-11">—</p>
      </section>
      <section class="rounded-lg border border-n-brand p-4">
        <h3 class="text-xs uppercase text-n-slate-11 mb-2">{{ t('BLINKONE.SLA.DASHBOARD.BREACHED') }}</h3>
        <div v-for="i in dash.breached" :key="i.id" class="text-sm py-1">
          #{{ i.conversationId }} — {{ i.policyName }}
        </div>
        <p v-if="!dash.breached?.length" class="text-xs text-n-slate-11">—</p>
      </section>
      <section class="rounded-lg border border-n-weak p-4">
        <h3 class="text-xs uppercase text-n-slate-11 mb-2">{{ t('BLINKONE.SLA.DASHBOARD.ACTIVE') }}</h3>
        <div v-for="i in dash.active" :key="i.id" class="text-sm py-1">
          #{{ i.conversationId }} — {{ i.targetType }}
        </div>
        <p v-if="!dash.active?.length" class="text-xs text-n-slate-11">—</p>
      </section>
    </div>
  </SettingsLayout>
  </BlinkoneFeatureGate>
</template>
